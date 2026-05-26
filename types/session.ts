/**
 * Workout Session — live execution log of a training session.
 *
 * Stored under `users/{uid}/workout_sessions/{sessionId}`.
 * Snake_case for all Firestore fields per ADR-006.
 *
 * Lifecycle:
 *   POST /api/sessions/start   → create session (status: in_progress)
 *   POST /api/sessions/[id]/log-set → append a SetLog to the matching exercise
 *   POST /api/sessions/[id]/finish → compute metrics, set status: completed
 *   POST /api/sessions/[id]/abort  → set status: aborted (with reason)
 *
 * After finish, the session_summary is also denormalized into
 * `users/{uid}.last_session_summary` for the dashboard / coach context.
 */

export type SessionStatus = "in_progress" | "completed" | "aborted";

export type SessionType =
  | "strength" // sets lourds, repos longs
  | "hypertrophy" // 8-12 reps, repos moyens
  | "endurance" // 15+ reps, repos courts
  | "hiit" // intervalles intenses
  | "miss" // moderate steady state
  | "liss" // low intensity steady state
  | "circuit" // enchaînement multi-exos
  | "mobility" // récupération / souplesse
  | "mixed";

export type LoadType =
  | "barbell"
  | "dumbbell"
  | "machine"
  | "cable"
  | "bodyweight"
  | "bodyweight_loaded"
  | "kettlebell"
  | "band"
  | "other";

/**
 * A single logged set during execution. Captures what the user actually did,
 * which can differ from `target_*` on the parent exercise (progressive overload
 * or autoregulation via RPE).
 */
export interface SetLog {
  set_index: number; // 1-indexed
  weight_kg: number; // 0 for bodyweight (use loaded_kg for +XX kg)
  loaded_kg?: number; // extra weight for bodyweight_loaded movements
  reps_done: number;
  rpe_felt: number; // 1-10 scale
  tempo_seconds?: number; // optional eccentric tempo
  rest_taken_seconds?: number; // actual rest before this set
  notes?: string;
  completed_at: string; // ISO
}

/**
 * One exercise slot in the session. References the canonical exercise
 * via `exercise_id` (FK to lib/features/exercises/database.json).
 *
 * `block_code` follows the NoDream convention: A1/A2 = superset block A,
 * B1/B2 = block B, F1 = finisher. Letters group exercises that share rest
 * timing (e.g. A1 + A2 alternate without rest, then 2-min rest before next round).
 */
export interface ExerciseSlot {
  block_code: string; // "A1", "A2", "B1", "F1", etc.
  exercise_id: string; // canonical slug (FK)
  exercise_name: string; // snapshot at session start (i18n stable)
  load_type: LoadType;
  target_sets: number;
  target_reps_range: string; // "8-12", "5", "AMRAP", "30s"
  target_rpe: number; // 1-10
  rest_seconds: number;
  sets_logged: SetLog[];
  // Optional pre-fill from last performance (rendered as "DERNIÈRE" badge)
  last_performance?: {
    weight_kg: number;
    reps_done: number;
    rpe_felt: number;
    performed_at: string; // ISO date
    days_ago: number;
  };
  notes?: string;
}

/**
 * Aggregated metrics computed on session finish.
 */
export interface SessionMetrics {
  duration_seconds: number;
  volume_kg: number; // sum of (weight_kg * reps_done) across all sets_logged
  tonnage_avg_per_set_kg: number;
  density_sets_per_min: number; // total sets / (duration_minutes)
  calories_est_kcal: number; // heuristic: METs * weight * hours
  water_consumed_l: number;
  water_target_l: number;
  sets_completed: number;
  sets_planned: number;
  completion_pct: number; // 0-100
  // Comparison vs previous session of the same split
  vs_previous_volume_pct?: number; // +3 = 3% more volume than last time
}

/**
 * Optional snapshot from a connected wearable (Google Fit / Apple Health).
 * Populated by the post-session sync (Wave 4 — out of scope for V1).
 */
export interface BioSnapshot {
  hr_avg_bpm?: number;
  hr_max_bpm?: number;
  hrv_ms?: number;
  zones_minutes?: {
    z1?: number;
    z2?: number;
    z3?: number;
    z4?: number;
    z5?: number;
  };
  source?: "google_fit" | "apple_health" | "polar" | "garmin" | "manual";
  synced_at?: string; // ISO
}

/**
 * Log of a single ORACLE.IA audio prompt played during the session.
 * Used by the coach context-builder for the post-session debrief.
 */
export interface CoachAudioEvent {
  emitted_at: string; // ISO
  trigger: "set_start" | "set_finish" | "rest_start" | "rest_end" | "form_cue" | "encouragement";
  text: string;
  audio_url?: string; // GCS path to the TTS file (optional cache)
  exercise_id?: string;
}

export interface SessionDoc {
  id?: string; // Firestore doc id
  plan_id: string; // FK to users/{uid}/plans/{planId}
  session_code: string; // "PUSH-V47", "PULL-V12", "LEGS-V03"
  operation_name: string; // "Push · Pecs / Triceps"
  session_type: SessionType;
  status: SessionStatus;
  started_at: string; // ISO
  finished_at?: string; // ISO
  aborted_reason?: string;
  exercises: ExerciseSlot[];
  metrics: SessionMetrics;
  bio_snapshot?: BioSnapshot;
  coach_audio_events?: CoachAudioEvent[];
  user_notes?: string;
  // Reference to the user's training_history snapshot at session start
  user_level_snapshot: "debutant" | "intermediaire" | "avance";
}

/**
 * Denormalized summary written to users/{uid}.last_session_summary
 * for fast dashboard reads + coach context injection.
 */
export interface LastSessionSummary {
  session_id: string;
  session_code: string;
  operation_name: string;
  finished_at: string;
  duration_seconds: number;
  volume_kg: number;
  completion_pct: number;
  vs_previous_volume_pct?: number;
  top_lift?: {
    exercise_name: string;
    weight_kg: number;
    reps_done: number;
    rpe_felt: number;
  };
}
