/**
 * POST /api/sessions/log-full
 *
 * Body: {
 *   plan_id: string,
 *   session_block_index?: number,        // défaut 0
 *   operation_name?: string,
 *   started_at?: string,                  // ISO, défaut: now - duration_minutes
 *   duration_minutes?: number,            // saisi par l'user dans le formulaire
 *   exercises: Array<{
 *     exercise_id: string,
 *     exercise_name: string,
 *     sets_logged: Array<{
 *       set_index: number,
 *       weight_kg: number,
 *       loaded_kg?: number,
 *       reps_done: number,
 *       rpe_felt: number,
 *       notes?: string,
 *     }>,
 *   }>,
 *   user_notes?: string,
 * }
 *
 * Pattern industrie standard (Strong/Hevy/Jefit) : un seul POST à la fin de
 * la séance avec toutes les données. Pas de transaction concurrente, pas de
 * write par set. On crée directement le doc avec status='completed' et on
 * calcule les metrics en bulk.
 *
 * Filtre systématiquement les `undefined` avant le write Firestore Admin SDK.
 */
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { authenticateRequest } from "@/lib/features/sessions/auth";
import {
  computeSessionMetrics,
  findTopLift,
  generateSessionCode,
} from "@/lib/features/sessions/session-utils";
import { checkRateLimit } from "@/lib/firebase/rate-limit";
import type {
  SessionDoc,
  ExerciseSlot,
  SetLog,
  LoadType,
} from "@/types/session";
import type { PlanDoc, PlanTrainingSession } from "@/types/plan";

export const runtime = "nodejs";

interface LogFullBody {
  plan_id: string;
  session_block_index?: number;
  operation_name?: string;
  started_at?: string;
  duration_minutes?: number;
  exercises: Array<{
    exercise_id: string;
    exercise_name: string;
    sets_logged: Array<{
      set_index: number;
      weight_kg: number;
      loaded_kg?: number;
      reps_done: number;
      rpe_felt: number;
      notes?: string;
    }>;
  }>;
  user_notes?: string;
}

/**
 * Supprime récursivement les champs `undefined` d'un objet ou array avant
 * tx.set/tx.update Firestore Admin SDK (qui les rejette).
 */
function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => stripUndefined(v)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) out[k] = stripUndefined(v);
    }
    return out as unknown as T;
  }
  return value;
}

function inferLoadType(name: string): LoadType {
  const n = name.toLowerCase();
  if (n.includes("barre")) return "barbell";
  if (n.includes("haltère") || n.includes("halt")) return "dumbbell";
  if (n.includes("machine") || n.includes("press") || n.includes("hack")) return "machine";
  if (n.includes("poulie") || n.includes("cable")) return "cable";
  if (n.includes("kettlebell") || n.includes("kb")) return "kettlebell";
  if (n.includes("élastique") || n.includes("band")) return "band";
  if (n.includes("lesté") || n.includes("dip") || n.includes("traction")) return "bodyweight_loaded";
  if (n.includes("planche") || n.includes("burpee") || n.includes("squat saut")) return "bodyweight";
  return "other";
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { uid } = auth;

  // Rate-limit doux : 12 séances/heure max (réaliste : ~3 séances/jour max)
  const rl = await checkRateLimit(uid, {
    scope: "sessions_log_full",
    perMinute: 6,
    perHour: 12,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate_limited", retry_after_sec: rl.retryAfterSec },
      { status: 429 },
    );
  }

  let body: LogFullBody;
  try {
    body = (await req.json()) as LogFullBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body?.plan_id) {
    return NextResponse.json({ error: "plan_id required" }, { status: 400 });
  }
  if (!Array.isArray(body.exercises) || body.exercises.length === 0) {
    return NextResponse.json({ error: "exercises required (non-empty array)" }, { status: 400 });
  }

  // Validation des ranges côté serveur (le client validate aussi, mais on protège)
  for (const ex of body.exercises) {
    if (!ex.exercise_id || !ex.exercise_name) {
      return NextResponse.json({ error: "exercise_id and exercise_name required for each exercise" }, { status: 400 });
    }
    if (!Array.isArray(ex.sets_logged)) {
      return NextResponse.json({ error: "sets_logged must be an array" }, { status: 400 });
    }
    for (const set of ex.sets_logged) {
      if (typeof set.weight_kg !== "number" || set.weight_kg < 0 || set.weight_kg > 600) {
        return NextResponse.json({ error: "weight_kg out of range (0-600)" }, { status: 400 });
      }
      if (typeof set.reps_done !== "number" || set.reps_done < 0 || set.reps_done > 200) {
        return NextResponse.json({ error: "reps_done out of range (0-200)" }, { status: 400 });
      }
      if (typeof set.rpe_felt !== "number" || set.rpe_felt < 1 || set.rpe_felt > 10) {
        return NextResponse.json({ error: "rpe_felt out of range (1-10)" }, { status: 400 });
      }
    }
  }

  const userRef = adminDb.collection("users").doc(uid);

  // 1. Charge le plan pour snapshot des targets
  const planSnap = await userRef.collection("plans").doc(body.plan_id).get();
  if (!planSnap.exists) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }
  const plan = planSnap.data() as PlanDoc;

  const blockIndex = body.session_block_index ?? 0;
  const trainingBlock: PlanTrainingSession | undefined = plan.training?.sessions?.[blockIndex];
  if (!trainingBlock) {
    return NextResponse.json({ error: `No training block at index ${blockIndex}` }, { status: 400 });
  }

  // 2. Snapshot user level
  const userSnap = await userRef.get();
  const userData = userSnap.data() ?? {};
  const userLevel: SessionDoc["user_level_snapshot"] =
    (userData.profile?.training_history === "beginner" && "debutant") ||
    (userData.profile?.training_history === "advanced" && "avance") ||
    "intermediaire";
  const userWeight = (userData.profile?.weight as number) ?? 75;

  // 3. Build ExerciseSlots : on associe chaque body.exercise au target du plan
  // pour récupérer target_sets/target_reps/rest. Si pas de match, on fallback.
  const planExos = trainingBlock.exercises ?? [];
  const exerciseSlots: ExerciseSlot[] = body.exercises.map((ex, idx) => {
    const planMatch = planExos.find((p) => slugify(p.name) === ex.exercise_id)
      ?? planExos[idx];

    const sets_logged: SetLog[] = ex.sets_logged.map((s) => {
      const cleanSet: SetLog = {
        set_index: s.set_index,
        weight_kg: s.weight_kg,
        reps_done: s.reps_done,
        rpe_felt: s.rpe_felt,
        completed_at: new Date().toISOString(),
        ...(s.loaded_kg !== undefined && { loaded_kg: s.loaded_kg }),
        ...(s.notes !== undefined && { notes: s.notes }),
      };
      return cleanSet;
    });

    const slot: ExerciseSlot = {
      block_code: `E${idx + 1}`,
      exercise_id: ex.exercise_id,
      exercise_name: ex.exercise_name,
      load_type: inferLoadType(ex.exercise_name),
      target_sets: planMatch?.sets ?? sets_logged.length,
      target_reps_range: planMatch?.reps ?? "—",
      target_rpe: 8,
      rest_seconds: planMatch?.rest_seconds ?? 90,
      sets_logged,
    };
    return slot;
  });

  // 4. Compute started_at / finished_at
  const finishedAt = new Date();
  const durationMinutes = Math.max(0, Math.min(360, body.duration_minutes ?? 60));
  const startedAt = body.started_at
    ? new Date(body.started_at)
    : new Date(finishedAt.getTime() - durationMinutes * 60_000);

  // 5. Compute metrics (bulk, no live recomputation)
  const operationName = body.operation_name ?? trainingBlock.name;
  const metrics = computeSessionMetrics(
    {
      exercises: exerciseSlots,
      started_at: startedAt.toISOString(),
      finished_at: finishedAt.toISOString(),
    },
    userWeight,
    0, // water_consumed_l (pas tracké en log post-séance)
    1.5, // water_target_l default
  );

  // 6. Generate session_code en comptant les sessions complétées de même operation
  const priorCountSnap = await userRef
    .collection("workout_sessions")
    .where("operation_name", "==", operationName)
    .where("status", "==", "completed")
    .count()
    .get();
  const sessionCode = generateSessionCode(operationName, priorCountSnap.data().count);

  // 7. Build le doc final (avec stripUndefined comme garde-fou final)
  const sessionData: SessionDoc = stripUndefined({
    plan_id: body.plan_id,
    session_code: sessionCode,
    operation_name: operationName,
    session_type: "hypertrophy", // safe default; on pourrait inférer du bloc
    status: "completed",
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    exercises: exerciseSlots,
    metrics,
    user_level_snapshot: userLevel,
    ...(body.user_notes ? { user_notes: body.user_notes } : {}),
  });

  // 8. Persist en 1 seule transaction : create session + update last_session_summary
  const sessionRef = userRef.collection("workout_sessions").doc();
  const topLift = findTopLift(exerciseSlots);
  const lastSessionSummary = stripUndefined({
    session_id: sessionRef.id,
    session_code: sessionCode,
    operation_name: operationName,
    finished_at: finishedAt.toISOString(),
    duration_seconds: metrics.duration_seconds,
    volume_kg: metrics.volume_kg,
    completion_pct: metrics.completion_pct,
    ...(metrics.vs_previous_volume_pct !== undefined && {
      vs_previous_volume_pct: metrics.vs_previous_volume_pct,
    }),
    ...(topLift ? { top_lift: topLift } : {}),
  });

  try {
    const batch = adminDb.batch();
    batch.set(sessionRef, sessionData);
    batch.set(
      userRef,
      { last_session_summary: lastSessionSummary },
      { merge: true },
    );
    await batch.commit();
  } catch (err) {
    console.error("[sessions/log-full] persist failed:", err);
    return NextResponse.json(
      { error: "persist_failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { ok: true, session_id: sessionRef.id, metrics, top_lift: topLift ?? null },
    { status: 201 },
  );
}

function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
