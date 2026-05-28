/**
 * POST /api/sessions/[sessionId]/finish
 *
 * Body: { water_consumed_l?: number, user_notes?: string }
 *
 * Closes the session:
 * - sets status: completed + finished_at
 * - recomputes final metrics including vs_previous_volume_pct
 * - identifies the top_lift
 * - denormalizes a LastSessionSummary into users/{uid}.last_session_summary
 *   for fast dashboard reads + coach context injection
 */
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { authenticateRequest } from "@/lib/features/sessions/auth";
import {
  computeSessionMetrics,
  findTopLift,
} from "@/lib/features/sessions/session-utils";
import { detectPrsFromSession } from "@/lib/features/personal-records/store";
import type { SessionDoc, LastSessionSummary } from "@/types/session";

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

  let body: { water_consumed_l?: number; user_notes?: string } = {};
  try {
    body = await req.json();
  } catch {
    // empty body acceptable
  }

  const sessionRef = adminDb
    .collection("users").doc(uid)
    .collection("workout_sessions").doc(sessionId);

  try {
    const summary = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(sessionRef);
      if (!snap.exists) {
        throw Object.assign(new Error("Session not found"), { status: 404 });
      }
      const session = snap.data() as SessionDoc;
      if (session.status !== "in_progress") {
        throw Object.assign(new Error("Session not in_progress"), { status: 409 });
      }

      const userSnap = await tx.get(adminDb.collection("users").doc(uid));
      const userWeight = (userSnap.data()?.profile?.weight as number) ?? 75;

      // Lookup last completed session of same operation_name for delta
      const priorSnap = await adminDb
        .collection("users").doc(uid)
        .collection("workout_sessions")
        .where("status", "==", "completed")
        .where("operation_name", "==", session.operation_name)
        .orderBy("finished_at", "desc")
        .limit(1)
        .get();
      const previousVolumeKg =
        priorSnap.docs[0]?.data()?.metrics?.volume_kg ?? undefined;

      const finishedAt = new Date().toISOString();
      const metrics = computeSessionMetrics(
        { ...session, finished_at: finishedAt },
        userWeight,
        body.water_consumed_l ?? session.metrics.water_consumed_l,
        session.metrics.water_target_l,
        previousVolumeKg,
      );

      const topLift = findTopLift(session.exercises);

      tx.update(sessionRef, {
        status: "completed",
        finished_at: finishedAt,
        metrics,
        user_notes: body.user_notes ?? null,
      });

      // Denormalize summary onto user doc
      const lastSummary: LastSessionSummary = {
        session_id: sessionId,
        session_code: session.session_code,
        operation_name: session.operation_name,
        finished_at: finishedAt,
        duration_seconds: metrics.duration_seconds,
        volume_kg: metrics.volume_kg,
        completion_pct: metrics.completion_pct,
        vs_previous_volume_pct: metrics.vs_previous_volume_pct,
        top_lift: topLift,
      };
      tx.set(
        adminDb.collection("users").doc(uid),
        { last_session_summary: lastSummary },
        { merge: true },
      );

      return lastSummary;
    });

    // Phase 3 data-layer : détection auto des PR depuis cette session.
    // Best-effort : si ça throw, on log mais on ne casse pas la réponse user
    // (la session est déjà persistée comme completed).
    try {
      const fresh = await sessionRef.get();
      const data = fresh.data();
      if (data) {
        const detected = await detectPrsFromSession(uid, sessionId, {
          date: data.date as string | undefined,
          exercises: data.exercises as Array<Record<string, unknown>> | undefined,
        });
        if (detected > 0) {
          console.log(`[sessions/finish] ${detected} new PR(s) detected for ${uid}`);
        }
      }
    } catch (prErr) {
      console.warn("[sessions/finish] PR detection failed (non-blocking):", prErr);
    }

    return NextResponse.json({ ok: true, summary });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status ?? 500;
    const message = (err as { message?: string })?.message ?? "Internal error";
    console.error("[sessions/finish] failed:", err);
    return NextResponse.json({ error: message }, { status });
  }
}
