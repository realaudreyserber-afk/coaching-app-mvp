/**
 * Embedder — wrapper Vertex AI REST API.
 *
 * Pourquoi REST direct et pas un SDK ? Évite d'ajouter @google-cloud/aiplatform
 * (~30 MB de deps gRPC) alors qu'on utilise déjà @google-cloud/vertexai pour
 * la génération. L'API embeddings est simple : 1 POST avec un token Bearer.
 *
 * Auth: Application Default Credentials via google-auth-library (déjà installée
 * comme dep transitive de firebase-admin et @google-cloud/vertexai).
 *
 * Coût: text-multilingual-embedding-002 est gratuit jusqu'à 100k requests/mois,
 * puis $0.0001 / 1k caractères. Pour 1000 users × 50 messages/jour × 30 jours
 * = 1.5M embeddings/mois × 100 chars moy = 150M chars = $15/mois. Acceptable.
 *
 * Used by:
 * - scripts/build-rag-embeddings.mjs (offline indexation)
 * - lib/features/rag-coach/retrieve.ts (runtime query embedding)
 */

import { EMBEDDING_MODEL, EMBEDDING_DIMS } from "./types";

const VERTEX_LOCATION = process.env.VERTEX_LOCATION || "europe-west1";
const VERTEX_PROJECT =
  process.env.VERTEX_PROJECT ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.FIREBASE_PROJECT_ID ||
  "";

type AuthClient = { getAccessToken: () => Promise<string | null | undefined> };

let cachedClient: AuthClient | null = null;

async function getAccessToken(): Promise<string> {
  if (!cachedClient) {
    // google-auth-library is a transitive dep of firebase-admin
    const { GoogleAuth } = await import("google-auth-library");
    const auth = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });
    cachedClient = (await auth.getClient()) as unknown as AuthClient;
  }
  const tok = await cachedClient.getAccessToken();
  if (!tok) throw new Error("[embedder] failed to obtain access token");
  return typeof tok === "string" ? tok : (tok as { token?: string }).token!;
}

interface PredictionResponse {
  predictions?: Array<{
    embeddings?: { values: number[] };
  }>;
}

/**
 * Embed a single text. Returns an L2-normalized vector of EMBEDDING_DIMS floats.
 *
 * @param text input string (max ~3072 tokens for this model)
 * @param taskType optional task hint (RETRIEVAL_DOCUMENT for indexing, RETRIEVAL_QUERY for queries)
 */
export async function embedText(
  text: string,
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY" = "RETRIEVAL_QUERY",
): Promise<number[]> {
  if (!VERTEX_PROJECT) {
    throw new Error("[embedder] VERTEX_PROJECT / GOOGLE_CLOUD_PROJECT env required");
  }
  const trimmed = text.slice(0, 8000); // safety: ~2k tokens cap
  const token = await getAccessToken();
  const url = `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${VERTEX_PROJECT}/locations/${VERTEX_LOCATION}/publishers/google/models/${EMBEDDING_MODEL}:predict`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      instances: [{ content: trimmed, task_type: taskType }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`[embedder] API ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as PredictionResponse;
  const vec = data.predictions?.[0]?.embeddings?.values;
  if (!vec || vec.length !== EMBEDDING_DIMS) {
    throw new Error(
      `[embedder] unexpected vector shape: got ${vec?.length}, expected ${EMBEDDING_DIMS}`,
    );
  }
  return l2Normalize(vec);
}

/**
 * Batch embed up to 250 texts in a single Vertex AI call.
 * Much faster than 1×N for offline indexation.
 */
export async function embedBatch(
  texts: string[],
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY" = "RETRIEVAL_DOCUMENT",
): Promise<number[][]> {
  if (texts.length === 0) return [];
  if (texts.length > 250) {
    // Vertex limit per request — caller should chunk.
    throw new Error("[embedder] batch size > 250; chunk before calling");
  }
  if (!VERTEX_PROJECT) {
    throw new Error("[embedder] VERTEX_PROJECT / GOOGLE_CLOUD_PROJECT env required");
  }
  const token = await getAccessToken();
  const url = `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${VERTEX_PROJECT}/locations/${VERTEX_LOCATION}/publishers/google/models/${EMBEDDING_MODEL}:predict`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      instances: texts.map((t) => ({ content: t.slice(0, 8000), task_type: taskType })),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`[embedder] API ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as PredictionResponse;
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i++) {
    const v = data.predictions?.[i]?.embeddings?.values;
    if (!v || v.length !== EMBEDDING_DIMS) {
      throw new Error(`[embedder] missing vector at index ${i}`);
    }
    out.push(l2Normalize(v));
  }
  return out;
}

/**
 * In-place L2 normalization. After this, dot(a, b) === cosine(a, b).
 */
export function l2Normalize(v: number[]): number[] {
  let sum = 0;
  for (const x of v) sum += x * x;
  const norm = Math.sqrt(sum) || 1;
  return v.map((x) => x / norm);
}
