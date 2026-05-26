/**
 * POST /api/sessions/[sessionId]/abort
 *
 * Body: { reason?: string }
 *
 * Marks an in_progress session as aborted (with optional reason).
 * Does NOT denormalize a LastSessionSummary (aborted sessions don't count
 * as the user's "last session" for coach context).
 *
 * Aborted sessions are kept in the collection for audit / retrospective
 * (the coach can reference them: "tu as arrêté ta dernière séance après
 * 2 exos, on va revoir la programmation").
 */
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { authenticateRequest } from "@/lib/features/sessions/auth";
import {
  computeSessionMetrics,
} from "@/lib/features/sessions/session-utils";
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

  let body: { reason?: string } = {};
  try {
    body = await req.json();
  } catch {
    // empty body acceptable
  }

  const sessionRef = adminDb
    .collection("users").doc(uid)
    .collection("workout_sessions").doc(sessionId);

  try {
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(sessionRef);
      if (!snap.exists) {
        throw Object.assign(new Error("Session not found"), { status: 404 });
      }
      const session = snap.data() as SessionDoc;
      if (session.status !== "in_progress") {
        throw Object.assign(new Error("Session not in_progress"), { status: 409 });
      }

      const finishedAt = new Date().toISOString();
      const userSnap = await tx.get(adminDb.collection("users").doc(uid));
      const userWeight = (userSnap.data()?.profile?.weight as number) ?? 75;

      // Compute final metrics (partial — what was actually done)
      const metrics = computeSessionMetrics(
        { ...session, finished_at: finishedAt },
        userWeight,
        session.metrics.water_consumed_l,
        session.metrics.water_target_l,
      );

      tx.update(sessionRef, {
        status: "aborted",
        finished_at: finishedAt,
        aborted_reason: (body.reason ?? "no_reason_given").slice(0, 200),
        metrics,
      });
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status ?? 500;
    const message = (err as { message?: string })?.message ?? "Internal error";
    console.error("[sessions/abort] failed:", err);
    return NextResponse.json({ error: message }, { status });
  }
}
