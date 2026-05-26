#!/usr/bin/env node
/**
 * scripts/build-rag-embeddings.mjs
 *
 * Offline indexation of the coach RAG.
 *
 * Reads:
 * - lib/features/exercises/database.json (148 + ~80 bodyweight exos)
 * - lib/features/training-methods/knowledge.md (20 sections)
 *
 * Writes:
 * - lib/features/rag-coach/embeddings/exercises.json
 * - lib/features/rag-coach/embeddings/methods.json
 *
 * Calls Vertex AI text-multilingual-embedding-002 in batches of 200.
 * Cost: ~250 exos + 20 methods = 270 docs ≈ 60k chars total ≈ $0.006.
 *
 * Run with:
 *   GOOGLE_APPLICATION_CREDENTIALS=./gcp-key.json \
 *   GOOGLE_CLOUD_PROJECT=your-project \
 *   VERTEX_LOCATION=europe-west1 \
 *   node scripts/build-rag-embeddings.mjs
 *
 * Or via npm:
 *   npm run build:rag
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleAuth } from "google-auth-library";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const VERTEX_LOCATION = process.env.VERTEX_LOCATION || "europe-west1";
const VERTEX_PROJECT =
  process.env.VERTEX_PROJECT ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.FIREBASE_PROJECT_ID;
const MODEL = "text-multilingual-embedding-002";
const DIMS = 768;
const BATCH = 100;

if (!VERTEX_PROJECT) {
  console.error(
    "❌ VERTEX_PROJECT / GOOGLE_CLOUD_PROJECT / FIREBASE_PROJECT_ID env required",
  );
  process.exit(1);
}

const auth = new GoogleAuth({
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});

async function getToken() {
  const client = await auth.getClient();
  const t = await client.getAccessToken();
  if (!t?.token) throw new Error("no token");
  return t.token;
}

function l2Normalize(v) {
  let s = 0;
  for (const x of v) s += x * x;
  const n = Math.sqrt(s) || 1;
  return v.map((x) => x / n);
}

async function embedBatch(texts, taskType = "RETRIEVAL_DOCUMENT") {
  const token = await getToken();
  const url = `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${VERTEX_PROJECT}/locations/${VERTEX_LOCATION}/publishers/google/models/${MODEL}:predict`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      instances: texts.map((t) => ({
        content: t.slice(0, 8000),
        task_type: taskType,
      })),
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Vertex ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  return texts.map((_, i) => {
    const v = data.predictions?.[i]?.embeddings?.values;
    if (!v || v.length !== DIMS) {
      throw new Error(`bad vector at ${i}: len=${v?.length}`);
    }
    return l2Normalize(v);
  });
}

async function chunkedEmbed(texts) {
  const out = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    console.log(`  → batch ${i / BATCH + 1}/${Math.ceil(texts.length / BATCH)} (${batch.length} docs)`);
    const vecs = await embedBatch(batch);
    out.push(...vecs);
  }
  return out;
}

// ─────────────────────────────────────────────
// Index 1 : EXERCISES
// ─────────────────────────────────────────────

function buildExerciseSearchText(exo) {
  // Concatenate searchable fields. The query will match against this blob.
  const parts = [
    exo.name_fr,
    exo.name_en,
    ...(exo.aliases || []),
    `Muscles : ${[...exo.primary_muscles, ...exo.secondary_muscles].join(", ")}`,
    `Pattern : ${exo.movement_pattern}`,
    `Catégorie : ${exo.category}`,
    `Niveau : ${exo.level}`,
    `Équipement : ${exo.equipment.join(", ")}`,
    ...(exo.cues_technique || []),
  ];
  return parts.filter(Boolean).join(" | ");
}

async function buildExercisesIndex() {
  console.log("\n🏋️  Building EXERCISES index...");
  // Load base DB
  const baseRaw = await readFile(
    join(ROOT, "lib/features/exercises/database.json"),
    "utf-8",
  );
  const base = JSON.parse(baseRaw);

  // Optionally merge a bodyweight extension file if it exists
  let bodyweight = [];
  try {
    const bwRaw = await readFile(
      join(ROOT, "lib/features/exercises/database-bodyweight.json"),
      "utf-8",
    );
    bodyweight = JSON.parse(bwRaw);
    console.log(`  ↳ merged ${bodyweight.length} bodyweight exercises`);
  } catch {
    console.log("  ↳ no bodyweight extension found (lib/features/exercises/database-bodyweight.json)");
  }
  const all = [...base, ...bodyweight];
  // Dedupe by id (in case of overlap)
  const seen = new Map();
  for (const e of all) {
    if (!seen.has(e.id)) seen.set(e.id, e);
  }
  const exos = [...seen.values()];

  console.log(`  ↳ indexing ${exos.length} exercises`);
  const texts = exos.map(buildExerciseSearchText);
  const vectors = await chunkedEmbed(texts);

  const records = exos.map((exo, i) => ({
    id: exo.id,
    label: exo.name_fr,
    vector: vectors[i],
    payload: {
      name_fr: exo.name_fr,
      primary_muscles: exo.primary_muscles,
      movement_pattern: exo.movement_pattern,
      category: exo.category,
      level: exo.level,
      equipment: exo.equipment,
      loadable_bodyweight: exo.loadable_bodyweight,
      full_id: exo.id,
    },
  }));

  const index = {
    model: MODEL,
    dims: DIMS,
    created_at: new Date().toISOString(),
    count: records.length,
    records,
  };

  const outDir = join(ROOT, "lib/features/rag-coach/embeddings");
  await mkdir(outDir, { recursive: true });
  await writeFile(
    join(outDir, "exercises.json"),
    JSON.stringify(index),
    "utf-8",
  );
  console.log(`  ✅ wrote ${records.length} exercise embeddings`);
}

// ─────────────────────────────────────────────
// Index 2 : TRAINING METHODS
// ─────────────────────────────────────────────

/** Parse knowledge.md and split by "## N. METHOD_NAME" headers */
function splitMethodsMarkdown(md) {
  const sections = [];
  const lines = md.split("\n");
  let current = null;
  for (const line of lines) {
    const m = line.match(/^##\s+(\d+)\.\s+(.+)$/);
    if (m) {
      if (current) sections.push(current);
      current = {
        section: parseInt(m[1], 10),
        name: m[2].trim(),
        body: "",
      };
    } else if (current) {
      current.body += line + "\n";
    }
  }
  if (current) sections.push(current);
  return sections;
}

function summarizeMethod(body) {
  // Grab the first "**Définition**" line (or first non-empty line if absent)
  const defMatch = body.match(/\*\*Définition\*\*\s*:\s*([^\n]+)/);
  if (defMatch) return defMatch[1].slice(0, 200);
  const firstLine = body.split("\n").find((l) => l.trim().startsWith("- "));
  return (firstLine ?? "").slice(0, 200);
}

function detectLevel(body) {
  const m = body.match(/\*\*Niveau\*\*\s*:\s*([^\n.]+)/);
  if (!m) return "tous";
  const txt = m[1].toLowerCase();
  if (txt.includes("avancé") || txt.includes("avance")) return "avance";
  if (txt.includes("intermédiaire") || txt.includes("intermediaire")) return "intermediaire";
  if (txt.includes("débutant") || txt.includes("debutant") || txt.includes("tous"))
    return "debutant";
  return "tous";
}

async function buildMethodsIndex() {
  console.log("\n🎯 Building METHODS index...");
  const md = await readFile(
    join(ROOT, "lib/features/training-methods/knowledge.md"),
    "utf-8",
  );
  const sections = splitMethodsMarkdown(md);
  // Skip section 0 (GRILLE NIVEAUX) since it's referenced separately
  const methods = sections.filter((s) => s.section >= 1);
  console.log(`  ↳ indexing ${methods.length} method sections`);

  const texts = methods.map(
    (m) => `${m.name}. ${m.body.slice(0, 2000)}`,
  );
  const vectors = await chunkedEmbed(texts);

  const records = methods.map((m, i) => ({
    id: `method_${String(m.section).padStart(2, "0")}`,
    label: m.name,
    vector: vectors[i],
    payload: {
      section: m.section,
      name: m.name,
      summary: summarizeMethod(m.body),
      level: detectLevel(m.body),
      excerpt: m.body.trim().slice(0, 2000),
    },
  }));

  const index = {
    model: MODEL,
    dims: DIMS,
    created_at: new Date().toISOString(),
    count: records.length,
    records,
  };

  const outDir = join(ROOT, "lib/features/rag-coach/embeddings");
  await mkdir(outDir, { recursive: true });
  await writeFile(
    join(outDir, "methods.json"),
    JSON.stringify(index),
    "utf-8",
  );
  console.log(`  ✅ wrote ${records.length} method embeddings`);
}

// ─────────────────────────────────────────────

async function main() {
  console.log(`🤖 RAG coach indexer · project=${VERTEX_PROJECT} loc=${VERTEX_LOCATION}`);
  const t0 = Date.now();
  await buildExercisesIndex();
  await buildMethodsIndex();
  console.log(`\n✨ done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

main().catch((e) => {
  console.error("❌ build failed:", e);
  process.exit(1);
});
