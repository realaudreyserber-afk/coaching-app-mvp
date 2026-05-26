/**
 * Session helpers — pure functions, no Firebase deps.
 * Unit-tested via lib/features/sessions/session-utils.test.ts.
 */

import type {
  SessionDoc,
  SessionMetrics,
  ExerciseSlot,
  SetLog,
} from "@/types/session";

/**
 * Generate a session code like "PUSH-V47" from operation name + incremented version.
 *
 * Convention: 3-4 letter slug + "-V" + 2-3 digit version.
 * Version is computed by counting prior sessions of the same operation kind.
 */
export function generateSessionCode(
  operationName: string,
  priorSessionsCountSameKind: number,
): string {
  // Normalize: strip diacritics, uppercase, take first salient word
  const normalized = operationName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .trim();
  // Pick the first word longer than 2 chars (skips "DE", "DU", etc.)
  const words = normalized.split(/[^A-Z]+/).filter((w) => w.length > 2);
  const slug = (words[0] ?? "SESS").slice(0, 5);
  const version = String(priorSessionsCountSameKind + 1).padStart(2, "0");
  return `${slug}-V${version}`;
}

/**
 * Compute live metrics from a partial session (used during execution + on finish).
 *
 * - volume_kg: Σ (weight_kg + loaded_kg ?? 0) × reps_done
 * - tonnage_avg_per_set_kg: volume_kg / sets_completed
 * - density_sets_per_min: sets_completed / (duration_seconds / 60)
 * - calories_est_kcal: MET-based heuristic (resistance training ~5 METs avg).
 *   kcal = METs × weight_kg × hours. Fallback weight 75 kg if unknown.
 */
export function computeSessionMetrics(
  session: Pick<SessionDoc, "exercises" | "started_at" | "finished_at">,
  userWeightKg: number = 75,
  waterConsumedL: number = 0,
  waterTargetL: number = 1.5,
  previousVolumeKg?: number,
): SessionMetrics {
  const startMs = new Date(session.started_at).getTime();
  const endMs = session.finished_at
    ? new Date(session.finished_at).getTime()
    : Date.now();
  const durationSeconds = Math.max(0, Math.floor((endMs - startMs) / 1000));

  let volumeKg = 0;
  let setsCompleted = 0;
  let setsPlanned = 0;

  for (const ex of session.exercises) {
    setsPlanned += ex.target_sets;
    for (const set of ex.sets_logged) {
      const load = set.weight_kg + (set.loaded_kg ?? 0);
      volumeKg += load * set.reps_done;
      setsCompleted += 1;
    }
  }

  const tonnageAvgPerSetKg =
    setsCompleted > 0 ? Math.round(volumeKg / setsCompleted) : 0;

  const durationMinutes = durationSeconds / 60;
  const densitySetsPerMin =
    durationMinutes > 0
      ? Math.round((setsCompleted / durationMinutes) * 100) / 100
      : 0;

  // Heuristic METs for resistance training: ~5 METs (moderate effort)
  const hours = durationSeconds / 3600;
  const caloriesEstKcal = Math.round(5 * userWeightKg * hours);

  const completionPct =
    setsPlanned > 0
      ? Math.min(100, Math.round((setsCompleted / setsPlanned) * 100))
      : 0;

  const vsPreviousVolumePct =
    previousVolumeKg && previousVolumeKg > 0
      ? Math.round(((volumeKg - previousVolumeKg) / previousVolumeKg) * 100)
      : undefined;

  return {
    duration_seconds: durationSeconds,
    volume_kg: Math.round(volumeKg),
    tonnage_avg_per_set_kg: tonnageAvgPerSetKg,
    density_sets_per_min: densitySetsPerMin,
    calories_est_kcal: caloriesEstKcal,
    water_consumed_l: waterConsumedL,
    water_target_l: waterTargetL,
    sets_completed: setsCompleted,
    sets_planned: setsPlanned,
    completion_pct: completionPct,
    vs_previous_volume_pct: vsPreviousVolumePct,
  };
}

/**
 * Identify the "top lift" of a session: the single set with the highest
 * estimated 1RM using the Epley formula: 1RM ≈ weight × (1 + reps/30).
 */
export function findTopLift(exercises: ExerciseSlot[]): {
  exercise_name: string;
  weight_kg: number;
  reps_done: number;
  rpe_felt: number;
} | undefined {
  let best: ReturnType<typeof findTopLift> | undefined;
  let bestE1rm = 0;

  for (const ex of exercises) {
    for (const set of ex.sets_logged) {
      const load = set.weight_kg + (set.loaded_kg ?? 0);
      if (load <= 0) continue;
      const e1rm = load * (1 + set.reps_done / 30);
      if (e1rm > bestE1rm) {
        bestE1rm = e1rm;
        best = {
          exercise_name: ex.exercise_name,
          weight_kg: load,
          reps_done: set.reps_done,
          rpe_felt: set.rpe_felt,
        };
      }
    }
  }
  return best;
}

/**
 * Append a SetLog to the right ExerciseSlot. Mutates a copy and returns it.
 * Throws if the exercise_id is not found in the session.
 */
export function appendSetLog(
  exercises: ExerciseSlot[],
  exerciseId: string,
  log: Omit<SetLog, "completed_at"> & { completed_at?: string },
): ExerciseSlot[] {
  const copy = exercises.map((ex) => ({ ...ex, sets_logged: [...ex.sets_logged] }));
  const target = copy.find((ex) => ex.exercise_id === exerciseId);
  if (!target) {
    throw new Error(`Exercise not found in session: ${exerciseId}`);
  }
  target.sets_logged.push({
    ...log,
    completed_at: log.completed_at ?? new Date().toISOString(),
  });
  return copy;
}

/**
 * Validate a SetLog payload — basic range checks to refuse garbage POST bodies.
 * Returns null if ok, or a string error reason.
 */
export function validateSetLogPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return "payload_not_object";
  const p = payload as Record<string, unknown>;
  if (typeof p.exercise_id !== "string" || !p.exercise_id) return "exercise_id_missing";
  if (typeof p.set_index !== "number" || p.set_index < 1 || p.set_index > 20) return "set_index_invalid";
  if (typeof p.reps_done !== "number" || p.reps_done < 0 || p.reps_done > 200) return "reps_done_invalid";
  if (typeof p.weight_kg !== "number" || p.weight_kg < 0 || p.weight_kg > 600) return "weight_kg_invalid";
  if (typeof p.rpe_felt !== "number" || p.rpe_felt < 1 || p.rpe_felt > 10) return "rpe_felt_invalid";
  if (p.loaded_kg !== undefined && (typeof p.loaded_kg !== "number" || p.loaded_kg < 0 || p.loaded_kg > 200)) {
    return "loaded_kg_invalid";
  }
  return null;
}
