/**
 * POST /api/sessions/[sessionId]/log-set
 *
 * Body: {
 *   exercise_id: string,
 *   set_index: number,
 *   weight_kg: number,
 *   loaded_kg?: number,
 *   reps_done: number,
 *   rpe_felt: number,
 *   tempo_seconds?: number,
 *   rest_taken_seconds?: number,
 *   notes?: string,
 * }
 *
 * Appends a SetLog to the matching ExerciseSlot. Computes live metrics
 * on each write so the dashboard can read them without recomputing.
 *
 * Uses a Firestore transaction to avoid race conditions when 2 sets
 * are logged close together (network retry, double-tap).
 */
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { authenticateRequest } from "@/lib/features/sessions/auth";
import {
  appendSetLog,
  computeSessionMetrics,
  validateSetLogPayload,
} from "@/lib/features/sessions/session-utils";
import { checkRateLimit } from "@/lib/firebase/rate-limit";
import type { SessionDoc } from "@/types/session";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { uid } = auth;
  const { sessionId } = await params;

  // Rate-limit: 60 sets/min is plenty (avg interval between sets is 1-3 min)
  const rl = await checkRateLimit(uid, {
    scope: "sessions_log_set",
    perMinute: 60,
    perHour: 600,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate_limited", retry_after_sec: rl.retryAfterSec },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validationErr = validateSetLogPayload(body);
  if (validationErr) {
    return NextResponse.json(
      { error: "validation_failed", reason: validationErr },
      { status: 400 },
    );
  }

  const payload = body as {
    exercise_id: string;
    set_index: number;
    weight_kg: number;
    loaded_kg?: number;
    reps_done: number;
    rpe_felt: number;
    tempo_seconds?: number;
    rest_taken_seconds?: number;
    notes?: string;
  };

  const sessionRef = adminDb
    .collection("users").doc(uid)
    .collection("workout_sessions").doc(sessionId);

  try {
    const result = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(sessionRef);
      if (!snap.exists) {
        return { status: 404, body: { error: "Session not found" } };
      }
      const session = snap.data() as SessionDoc;

      if (session.status !== "in_progress") {
        return {
          status: 409,
          body: { error: "Session not in_progress", current_status: session.status },
        };
      }

      // Append the set
      let updatedExercises;
      try {
        updatedExercises = appendSetLog(session.exercises, payload.exercise_id, {
          set_index: payload.set_index,
          weight_kg: payload.weight_kg,
          loaded_kg: payload.loaded_kg,
          reps_done: payload.reps_done,
          rpe_felt: payload.rpe_felt,
          tempo_seconds: payload.tempo_seconds,
          rest_taken_seconds: payload.rest_taken_seconds,
          notes: payload.notes,
        });
      } catch (err) {
        return {
          status: 404,
          body: { error: "Exercise not found in session", detail: String(err) },
        };
      }

      // Recompute metrics live
      const userSnap = await tx.get(adminDb.collection("users").doc(uid));
      const userWeight = (userSnap.data()?.profile?.weight as number) ?? 75;
      const metrics = computeSessionMetrics(
        { ...session, exercises: updatedExercises, finished_at: undefined },
        userWeight,
        session.metrics.water_consumed_l,
        session.metrics.water_target_l,
      );

      tx.update(sessionRef, {
        exercises: updatedExercises,
        metrics,
      });

      return {
        status: 200,
        body: {
          ok: true,
          metrics,
        },
      };
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (err) {
    console.error("[sessions/log-set] tx failed:", err);
    return NextResponse.json({ error: "Write failed" }, { status: 500 });
  }
}
