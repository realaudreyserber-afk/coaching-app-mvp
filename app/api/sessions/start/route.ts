/**
 * POST /api/sessions/start
 *
 * Body: { plan_id: string, session_type?: SessionType, operation_name?: string }
 *
 * Creates a new in_progress session under users/{uid}/workout_sessions/{sessionId}
 * by snapshotting the active plan's training block into ExerciseSlot[].
 *
 * Also injects last_performance from prior sessions (max 90 days lookback)
 * so the UI can render the "DERNIÈRE : +30kg × 9" badge.
 */
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { authenticateRequest } from "@/lib/features/sessions/auth";
import { generateSessionCode } from "@/lib/features/sessions/session-utils";
import { checkRateLimit } from "@/lib/firebase/rate-limit";
import type {
  SessionDoc,
  SessionType,
  ExerciseSlot,
} from "@/types/session";
import type { PlanDoc, PlanTrainingSession } from "@/types/plan";

export const runtime = "nodejs";

interface StartBody {
  plan_id: string;
  session_type?: SessionType;
  operation_name?: string;
  // Optional: pick a specific session block from the plan (else uses the first)
  session_block_index?: number;
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { uid } = auth;

  // Rate-limit: max 6 session starts / hour (prevents accidental spam)
  const rl = await checkRateLimit(uid, {
    scope: "sessions_start",
    perMinute: 3,
    perHour: 6,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate_limited", retry_after_sec: rl.retryAfterSec },
      { status: 429 },
    );
  }

  let body: StartBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body?.plan_id) {
    return NextResponse.json({ error: "plan_id required" }, { status: 400 });
  }

  // 1. Load the plan
  const planRef = adminDb
    .collection("users").doc(uid)
    .collection("plans").doc(body.plan_id);
  const planSnap = await planRef.get();
  if (!planSnap.exists) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }
  const plan = planSnap.data() as PlanDoc;

  // 2. Pick the training session block from the plan
  const sessions = plan.training?.sessions ?? [];
  const blockIndex = body.session_block_index ?? 0;
  const trainingBlock: PlanTrainingSession | undefined = sessions[blockIndex];
  if (!trainingBlock) {
    return NextResponse.json(
      { error: "No training block at index " + blockIndex },
      { status: 400 },
    );
  }

  // 3. Snapshot user training level
  const userSnap = await adminDb.collection("users").doc(uid).get();
  const userData = userSnap.data() ?? {};
  const userLevel: SessionDoc["user_level_snapshot"] =
    (userData.profile?.training_history === "beginner" && "debutant") ||
    (userData.profile?.training_history === "advanced" && "avance") ||
    "intermediaire";

  // 4. Build ExerciseSlots with block_code A1/A2/B1/... derived from order
  const exerciseSlots: ExerciseSlot[] = trainingBlock.exercises.map(
    (ex, idx) => ({
      block_code: buildBlockCode(idx),
      exercise_id: slugify(ex.name),
      exercise_name: ex.name,
      load_type: inferLoadType(ex.name),
      target_sets: ex.sets,
      target_reps_range: ex.reps,
      target_rpe: 8, // default; coach will personalize in V2
      rest_seconds: ex.rest_seconds,
      sets_logged: [],
    }),
  );

  // 5. Inject last_performance from prior completed sessions (lookback 90d)
  await injectLastPerformance(uid, exerciseSlots);

  // 6. Generate session_code by counting prior sessions of same operation kind
  const operationName = body.operation_name ?? trainingBlock.name;
  const priorQuery = await adminDb
    .collection("users").doc(uid)
    .collection("workout_sessions")
    .where("operation_name", "==", operationName)
    .count()
    .get();
  const sessionCode = generateSessionCode(operationName, priorQuery.data().count);

  // 7. Persist the session doc
  const sessionData: SessionDoc = {
    plan_id: body.plan_id,
    session_code: sessionCode,
    operation_name: operationName,
    session_type: body.session_type ?? inferSessionType(trainingBlock.name),
    status: "in_progress",
    started_at: new Date().toISOString(),
    exercises: exerciseSlots,
    metrics: {
      duration_seconds: 0,
      volume_kg: 0,
      tonnage_avg_per_set_kg: 0,
      density_sets_per_min: 0,
      calories_est_kcal: 0,
      water_consumed_l: 0,
      water_target_l: 1.5,
      sets_completed: 0,
      sets_planned: exerciseSlots.reduce((sum, ex) => sum + ex.target_sets, 0),
      completion_pct: 0,
    },
    user_level_snapshot: userLevel,
  };

  const docRef = await adminDb
    .collection("users").doc(uid)
    .collection("workout_sessions")
    .add(sessionData);

  return NextResponse.json(
    { ok: true, session_id: docRef.id, session: { ...sessionData, id: docRef.id } },
    { status: 201 },
  );
}

/**
 * Derive block_code from index. Convention: A1/A2 = first pair (superset block A),
 * B1/B2 = second pair, etc. Solo exos get A1 / B1 / C1 alone.
 * For V1 we group by pairs of 2 — coach can override in V2.
 */
function buildBlockCode(idx: number): string {
  const blockLetter = String.fromCharCode("A".charCodeAt(0) + Math.floor(idx / 2));
  const slot = (idx % 2) + 1;
  return `${blockLetter}${slot}`;
}

function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function inferLoadType(name: string): ExerciseSlot["load_type"] {
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

function inferSessionType(blockName: string): SessionType {
  const n = blockName.toLowerCase();
  if (n.includes("hiit") || n.includes("metcon")) return "hiit";
  if (n.includes("cardio") || n.includes("course")) return "miss";
  if (n.includes("mobilité") || n.includes("récup")) return "mobility";
  if (n.includes("circuit")) return "circuit";
  return "hypertrophy"; // safe default for muscu plans
}

/**
 * For each ExerciseSlot, find the most recent completed session in the last 90d
 * that logged at least one set for this exercise_id. Pick the set with the
 * highest e1RM (Epley) as the "last_performance" benchmark to beat.
 */
async function injectLastPerformance(
  uid: string,
  slots: ExerciseSlot[],
): Promise<void> {
  const ninetyDaysAgoMs = Date.now() - 90 * 24 * 3600 * 1000;
  const cutoffIso = new Date(ninetyDaysAgoMs).toISOString();

  const priorSnap = await adminDb
    .collection("users").doc(uid)
    .collection("workout_sessions")
    .where("status", "==", "completed")
    .where("started_at", ">=", cutoffIso)
    .orderBy("started_at", "desc")
    .limit(20)
    .get();

  // Build a map exercise_id → best (highest e1RM) recent set
  const bestByExercise = new Map<string, {
    weight_kg: number;
    reps_done: number;
    rpe_felt: number;
    performed_at: string;
  }>();

  for (const doc of priorSnap.docs) {
    const sess = doc.data() as SessionDoc;
    for (const ex of sess.exercises ?? []) {
      for (const set of ex.sets_logged ?? []) {
        const load = (set.weight_kg ?? 0) + (set.loaded_kg ?? 0);
        if (load <= 0 && set.reps_done <= 0) continue;
        const e1rm = load * (1 + (set.reps_done ?? 0) / 30);
        const existing = bestByExercise.get(ex.exercise_id);
        const existingE1rm = existing
          ? existing.weight_kg * (1 + existing.reps_done / 30)
          : 0;
        if (!existing || e1rm > existingE1rm) {
          bestByExercise.set(ex.exercise_id, {
            weight_kg: load,
            reps_done: set.reps_done,
            rpe_felt: set.rpe_felt,
            performed_at: set.completed_at ?? sess.started_at,
          });
        }
      }
    }
  }

  // Inject onto each slot
  for (const slot of slots) {
    const best = bestByExercise.get(slot.exercise_id);
    if (best) {
      const daysAgo = Math.floor(
        (Date.now() - new Date(best.performed_at).getTime()) / (24 * 3600 * 1000),
      );
      slot.last_performance = { ...best, days_ago: daysAgo };
    }
  }
}
