/**
 * RAG Coach — types partagés.
 *
 * Embeddings via Vertex AI `text-multilingual-embedding-002` (768 dims,
 * français natif). Stockage en JSON statique précalculé offline au build,
 * chargé en RAM au cold start (~1 MB pour 250+ exos + ~20 méthodes).
 *
 * Cosine similarity TS pur côté serveur. Pas de service tiers (Pinecone,
 * Weaviate, Vertex Vector Search) — overkill pour <1000 documents.
 */

export const EMBEDDING_MODEL = "text-multilingual-embedding-002";
export const EMBEDDING_DIMS = 768;

/**
 * Embedded record. Generic over the source doc type so we can re-use the
 * store for exercises, training methods, recipes, etc.
 */
export interface EmbeddedRecord<TPayload = unknown> {
  /** Stable identifier (matches the source doc id) */
  id: string;
  /** Human-readable label for debug/logs ("Squat barre arrière (high-bar)") */
  label: string;
  /** L2-normalized embedding vector (768 floats) */
  vector: number[];
  /** Optional metadata payload for post-filtering / display */
  payload: TPayload;
}

/**
 * On-disk format for the precomputed indexes.
 * `created_at` lets us detect a stale index if the source DB changes.
 */
export interface EmbeddingIndex<TPayload = unknown> {
  model: string;
  dims: number;
  created_at: string;
  count: number;
  records: EmbeddedRecord<TPayload>[];
}

/**
 * Search result with similarity score (cosine, 0-1 range with L2-normalized vectors).
 */
export interface RagHit<TPayload = unknown> {
  id: string;
  label: string;
  score: number;
  payload: TPayload;
}

/**
 * Payloads stored alongside embeddings — kept small to limit JSON size on cold start.
 */
export interface ExercisePayload {
  name_fr: string;
  primary_muscles: string[];
  movement_pattern: string;
  category: string;
  level: "debutant" | "intermediaire" | "avance";
  equipment: string[];
  loadable_bodyweight: boolean;
  /** Pointer into the full DB if more detail is needed (cues + safety) */
  full_id: string;
}

export interface MethodPayload {
  /** Section number in knowledge.md (1-20) */
  section: number;
  /** Short name like "Superset", "Rest-Pause", "HIIT classique" */
  name: string;
  /** Compact 80-char summary for context injection */
  summary: string;
  level: "debutant" | "intermediaire" | "avance" | "tous";
  /** Markdown excerpt to inject if this is the top-hit */
  excerpt: string;
}
