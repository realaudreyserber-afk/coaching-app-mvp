/**
 * Exercise library — canonical DB of 148+ musculation exercises.
 *
 * Source: ExRx.net, NSCA, Jeff Nippard, fact-checked Wave 3A research.
 * Schema: snake_case (ADR-006). Stored at lib/features/exercises/database.json.
 *
 * Lookup utilities for the coach prompts + UI autocomplete + session log validation.
 */

import database from "./database.json";

export type MovementPattern =
  | "push_horizontal"
  | "push_vertical"
  | "pull_horizontal"
  | "pull_vertical"
  | "squat"
  | "hinge"
  | "lunge"
  | "carry"
  | "rotation"
  | "isolation"
  | "plyometric";

export type ExerciseCategory =
  | "compound"
  | "isolation"
  | "plyometric"
  | "metabolic"
  | "core";

export type ExerciseLevel = "debutant" | "intermediaire" | "avance";

export interface ExerciseRecord {
  id: string;
  name_fr: string;
  name_en: string;
  aliases: string[];
  primary_muscles: string[];
  secondary_muscles: string[];
  equipment: string[];
  movement_pattern: MovementPattern;
  category: ExerciseCategory;
  level: ExerciseLevel;
  unilateral: boolean;
  loadable_bodyweight: boolean;
  notation_convention: string;
  rest_seconds_default: number;
  cues_technique: string[];
  safety_notes: string;
}

export const EXERCISES: ExerciseRecord[] = database as ExerciseRecord[];

// Index by id for O(1) lookup
const BY_ID = new Map<string, ExerciseRecord>(EXERCISES.map((e) => [e.id, e]));

export function findExerciseById(id: string): ExerciseRecord | undefined {
  return BY_ID.get(id);
}

/**
 * Fuzzy lookup by FR/EN name or alias (case-insensitive, NFD-stripped).
 * Returns the best match by Jaccard distance on word sets.
 */
export function findExerciseByName(query: string): ExerciseRecord | undefined {
  if (!query) return undefined;
  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const q = norm(query);
  if (!q) return undefined;
  // exact match by normalized id first
  const exact = BY_ID.get(q.replace(/ /g, "_"));
  if (exact) return exact;
  // fall back to alias / name match
  for (const ex of EXERCISES) {
    if (norm(ex.name_fr) === q || norm(ex.name_en) === q) return ex;
    if (ex.aliases.some((a) => norm(a) === q)) return ex;
  }
  // partial match: ex name contains query OR query contains ex name
  for (const ex of EXERCISES) {
    if (norm(ex.name_fr).includes(q) || q.includes(norm(ex.name_fr))) return ex;
  }
  return undefined;
}

/**
 * Filter by movement pattern (push_horizontal, etc.) — useful for the coach
 * to compose a balanced session.
 */
export function exercisesByPattern(p: MovementPattern): ExerciseRecord[] {
  return EXERCISES.filter((e) => e.movement_pattern === p);
}

/**
 * Filter by primary muscle group — useful for hypertrophy specialization phases.
 */
export function exercisesByPrimaryMuscle(muscle: string): ExerciseRecord[] {
  return EXERCISES.filter((e) => e.primary_muscles.includes(muscle));
}

/**
 * Filter by training level — to avoid prescribing advanced exos to beginners.
 */
export function exercisesByLevel(
  level: ExerciseLevel | ExerciseLevel[],
): ExerciseRecord[] {
  const allowed = new Set(Array.isArray(level) ? level : [level]);
  return EXERCISES.filter((e) => allowed.has(e.level));
}

/**
 * Filter by available equipment — for home/limited gym setups.
 */
export function exercisesByEquipment(available: string[]): ExerciseRecord[] {
  const set = new Set(available);
  return EXERCISES.filter((e) => e.equipment.every((eq) => set.has(eq) || eq === "aucun"));
}

/**
 * For the coach prompt: a compact textual dump (id + name_fr + primary_muscles
 * + level) suitable for injection into the system prompt without exploding tokens.
 */
export function exercisesCompactDump(filter?: {
  level?: ExerciseLevel | ExerciseLevel[];
  patterns?: MovementPattern[];
}): string {
  let list = EXERCISES;
  if (filter?.level) {
    const allowed = new Set(Array.isArray(filter.level) ? filter.level : [filter.level]);
    list = list.filter((e) => allowed.has(e.level));
  }
  if (filter?.patterns) {
    const set = new Set(filter.patterns);
    list = list.filter((e) => set.has(e.movement_pattern));
  }
  return list
    .map(
      (e) =>
        `- ${e.id} | ${e.name_fr} | muscles: ${e.primary_muscles.join(",")} | ${e.movement_pattern} | ${e.level}`,
    )
    .join("\n");
}

export const EXERCISE_COUNT = EXERCISES.length;
