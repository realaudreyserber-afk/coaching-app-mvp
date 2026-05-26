/**
 * Vector store — in-memory load + cosine top-K retrieval.
 *
 * Embeddings are L2-normalized at indexing time, so cosine similarity
 * reduces to dot product (faster, branch-free hot loop).
 *
 * Singleton pattern: indexes are loaded once at cold start and cached
 * for the lifetime of the serverless instance.
 */

import type {
  EmbeddingIndex,
  EmbeddedRecord,
  RagHit,
} from "./types";

const cache = new Map<string, EmbeddingIndex<unknown>>();

/**
 * Register an in-memory index. Called by the auto-loader on cold start
 * with the JSON blobs imported from disk.
 */
export function registerIndex<TPayload>(
  key: string,
  index: EmbeddingIndex<TPayload>,
): void {
  cache.set(key, index as EmbeddingIndex<unknown>);
}

export function getIndex<TPayload = unknown>(
  key: string,
): EmbeddingIndex<TPayload> | undefined {
  return cache.get(key) as EmbeddingIndex<TPayload> | undefined;
}

/**
 * Cosine similarity for two L2-normalized vectors.
 * Caller is responsible for L2-normalizing both inputs.
 */
export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`cosine: dim mismatch ${a.length} vs ${b.length}`);
  }
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

export interface SearchOptions<TPayload> {
  /** Number of results to return (default 5) */
  topK?: number;
  /** Optional payload predicate to filter results (e.g. by level / equipment) */
  filter?: (payload: TPayload, record: EmbeddedRecord<TPayload>) => boolean;
  /** Optional minimum similarity threshold (default 0.0 = no filter) */
  minScore?: number;
}

/**
 * Search the index by query vector. Returns top-K by descending similarity.
 *
 * For 200-500 documents, brute-force O(N) is fast enough (~0.5ms typical
 * with normalized 768-dim vectors). Switch to HNSW/IVF only if N > 10k.
 */
export function search<TPayload>(
  indexKey: string,
  queryVector: number[],
  opts: SearchOptions<TPayload> = {},
): RagHit<TPayload>[] {
  const idx = cache.get(indexKey) as EmbeddingIndex<TPayload> | undefined;
  if (!idx) {
    console.warn(`[rag-coach] index "${indexKey}" not registered`);
    return [];
  }
  const topK = opts.topK ?? 5;
  const minScore = opts.minScore ?? 0;

  const scored: RagHit<TPayload>[] = [];
  for (const rec of idx.records) {
    if (opts.filter && !opts.filter(rec.payload, rec)) continue;
    const score = cosine(queryVector, rec.vector);
    if (score < minScore) continue;
    scored.push({
      id: rec.id,
      label: rec.label,
      score,
      payload: rec.payload,
    });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}
