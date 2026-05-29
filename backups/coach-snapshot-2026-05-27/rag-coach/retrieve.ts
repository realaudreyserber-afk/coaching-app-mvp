/**
 * Public retrieval API for the coach + plan-generator.
 *
 * Two stable indexes:
 * - `exercises` : 250+ exos (salle + bodyweight) for "remplace mon squat",
 *   "tu connais le pistol squat ?", "exo pour le grand dorsal ?" queries.
 * - `methods` : 20 training methods (superset, drop-set, HIIT, cluster, etc.)
 *   for "c'est quoi un myo-rep ?", "ça vaut le coup les drop sets ?".
 *
 * Auto-loads the JSON indexes on first access. If an index file is missing
 * (e.g. fresh dev install where build:rag hasn't run yet), retrieval
 * degrades to empty results without crashing the request.
 */

import { embedText } from "./embedder";
import { registerIndex, search, getIndex } from "./store";
import type {
  EmbeddingIndex,
  ExercisePayload,
  MethodPayload,
  RagHit,
} from "./types";

// ─────────────────────────────────────────────────────────────
// Wave 7 #6 — Module-level LRU cache for query embeddings.
// Same user often repeats the same question across a session
// ("alternative au squat") so caching saves ~50% of Vertex calls.
// 500 entries × 15 min TTL = ~2 MB RAM cost on Vercel cold start.
// ─────────────────────────────────────────────────────────────

const EMBED_CACHE = new Map<string, { vector: number[]; created_at: number }>();
const EMBED_CACHE_MAX = 500;
const EMBED_CACHE_TTL_MS = 15 * 60 * 1000;

async function embedQueryCached(query: string): Promise<number[]> {
  const key = query.trim().toLowerCase();
  const cached = EMBED_CACHE.get(key);
  if (cached && Date.now() - cached.created_at < EMBED_CACHE_TTL_MS) {
    // LRU touch : delete + re-add so the entry moves to the end of the Map
    EMBED_CACHE.delete(key);
    EMBED_CACHE.set(key, cached);
    return cached.vector;
  }
  const vector = await embedText(query, "RETRIEVAL_QUERY");
  if (EMBED_CACHE.size >= EMBED_CACHE_MAX) {
    // Evict oldest (insertion order = LRU after the touch above)
    const firstKey = EMBED_CACHE.keys().next().value;
    if (firstKey) EMBED_CACHE.delete(firstKey);
  }
  EMBED_CACHE.set(key, { vector, created_at: Date.now() });
  return vector;
}

let loaded = false;

function ensureLoaded(): void {
  if (loaded) return;
  loaded = true;
  try {
    // Dynamic require so the build doesn't fail if the JSON isn't checked in yet
    /* eslint-disable @typescript-eslint/no-require-imports */
    const exos = require("./embeddings/exercises.json") as EmbeddingIndex<ExercisePayload>;
    registerIndex("exercises", exos);
  } catch (e) {
    console.warn("[rag-coach] exercises index not found — run `npm run build:rag`", e);
  }
  try {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const methods = require("./embeddings/methods.json") as EmbeddingIndex<MethodPayload>;
    registerIndex("methods", methods);
  } catch (e) {
    console.warn("[rag-coach] methods index not found — run `npm run build:rag`", e);
  }
}

export interface ExerciseRetrievalFilter {
  /** Filter by training level (the user's history) */
  maxLevel?: "debutant" | "intermediaire" | "avance";
  /** Filter by available equipment slugs. If set, only exos whose `equipment`
   *  is a subset of these (or "aucun") are returned. */
  availableEquipment?: string[];
  /** Filter by movement pattern */
  pattern?: string;
}

const LEVEL_ORDER: Record<"debutant" | "intermediaire" | "avance", number> = {
  debutant: 0,
  intermediaire: 1,
  avance: 2,
};

function levelAllowed(
  payloadLevel: "debutant" | "intermediaire" | "avance",
  maxLevel?: "debutant" | "intermediaire" | "avance",
): boolean {
  if (!maxLevel) return true;
  return LEVEL_ORDER[payloadLevel] <= LEVEL_ORDER[maxLevel];
}

function equipmentAllowed(
  exoEquipment: string[],
  available?: string[],
): boolean {
  if (!available || available.length === 0) return true;
  const allowed = new Set([...available, "aucun"]);
  return exoEquipment.every((e) => allowed.has(e));
}

/**
 * Retrieve top-K exercises matching the query. Returns label + payload only
 * (no embedding vector) to keep the response light for prompt injection.
 *
 * Example: retrieveExercises("alternative au squat barre pour mes genoux", {
 *   maxLevel: 'intermediaire',
 *   availableEquipment: ['barre', 'halteres', 'box'],
 * })
 */
export async function retrieveExercises(
  query: string,
  filter: ExerciseRetrievalFilter = {},
  topK = 8,
): Promise<RagHit<ExercisePayload>[]> {
  ensureLoaded();
  if (!getIndex("exercises")) return [];
  const qVec = await embedQueryCached(query);
  return search<ExercisePayload>("exercises", qVec, {
    topK,
    filter: (payload) =>
      levelAllowed(payload.level, filter.maxLevel) &&
      equipmentAllowed(payload.equipment, filter.availableEquipment) &&
      (!filter.pattern || payload.movement_pattern === filter.pattern),
  });
}

/**
 * Retrieve top-K training methods. Used when the user asks about a technique
 * by name ("c'est quoi un myo-rep ?", "ça change quoi le HIIT 1:2 vs 1:8 ?").
 */
export async function retrieveMethods(
  query: string,
  topK = 3,
): Promise<RagHit<MethodPayload>[]> {
  ensureLoaded();
  if (!getIndex("methods")) return [];
  const qVec = await embedQueryCached(query);
  return search<MethodPayload>("methods", qVec, { topK });
}

/**
 * Build a compact text block from retrieved hits, ready to drop into the
 * coach's system prompt for the current turn.
 *
 * Format:
 *   [EXERCISES MATCHING USER QUERY]
 *   - <name_fr> (<level>) — primary: <muscles> | pattern: <pattern> | equipment: <equipment>
 *   - ...
 *
 * Keep it terse — the goal is to constrain what the coach references, not
 * to dump the full DB. Cues + safety notes are only injected if the user
 * explicitly asks "comment je fais bien le squat ?" (top-1 hit, fetch full
 * record from the DB).
 */
export function formatExercisesForPrompt(
  hits: RagHit<ExercisePayload>[],
): string {
  if (hits.length === 0) return "";
  const lines = hits.map(
    (h) =>
      `- ${h.payload.name_fr} (${h.payload.level}) — primary: ${h.payload.primary_muscles.join(", ")} | pattern: ${h.payload.movement_pattern} | equipment: ${h.payload.equipment.join(", ")} | id: ${h.id}`,
  );
  return `\n[EXERCICES PERTINENTS POUR CETTE QUESTION]\n${lines.join("\n")}\n`;
}

export function formatMethodsForPrompt(
  hits: RagHit<MethodPayload>[],
): string {
  if (hits.length === 0) return "";
  const top = hits[0];
  const others = hits.slice(1);
  let block = `\n[MÉTHODE D'ENTRAÎNEMENT PRINCIPALE]\n## ${top.payload.name}\n${top.payload.excerpt.slice(0, 1500)}\n`;
  if (others.length > 0) {
    block += `\n[MÉTHODES SECONDAIRES]\n${others.map((h) => `- ${h.payload.name} : ${h.payload.summary}`).join("\n")}\n`;
  }
  return block;
}
