/**
 * POST /api/onboarding/restart
 *
 * Resets the onboarding-complete flag on the authenticated user so the
 * (app) layout guard sends them back through /onboarding. Useful when the
 * user wants to refine baseline data (BF%, training level, environment)
 * that wasn't collected in an earlier wizard version.
 *
 * Does NOT delete the profile, baseline, goals, plan_current_id, nor any
 * existing plan in the `plans/` subcollection — the user resumes from the
 * step that hasn't been filled and the next /api/ai/generate-plan call
 * will deactivate the current plan + archive it (active: false) before
 * creating the new one. Plan history is preserved.
 *
 * Request body : none (uid comes from withAuth).
 * Response : 200 { ok: true, resumeStep: number } or 401 / 500.
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { withAuth } from "@/lib/firebase/auth-middleware";

export async function POST(req: NextRequest) {
  return withAuth(req, async (_authenticatedReq, user) => {
    try {
      const userRef = adminDb.collection("users").doc(user.uid);
      const snap = await userRef.get();
      if (!snap.exists) {
        return NextResponse.json(
          { error: "Utilisateur introuvable." },
          { status: 404 },
        );
      }

      const data = snap.data() || {};
      // Resume at the first step that's missing a critical field. If everything
      // is filled (returning user just wants to refine BF%), resume at step 4.
      let resumeStep = 1;
      if (data.profile?.name && data.profile?.sex) resumeStep = 2;
      if (resumeStep === 2 && data.profile?.dob) resumeStep = 3;
      if (resumeStep === 3 && data.profile?.height && data.baseline?.weight) resumeStep = 4;
      if (resumeStep === 4 && typeof data.baseline?.bf_pct === "number") resumeStep = 5;
      if (resumeStep === 5 && data.profile?.activity_level) resumeStep = 6;
      if (resumeStep === 6 && data.profile?.training_history && data.profile?.training_environment) resumeStep = 7;
      if (resumeStep === 7 && data.goals?.type && data.goals?.target_weight) resumeStep = 8;

      await userRef.update({
        onboarding_completed: false,
        onboarding_step: resumeStep,
        onboarding_restarted_at: new Date().toISOString(),
      });

      return NextResponse.json({ ok: true, resumeStep });
    } catch (error) {
      console.error("[onboarding/restart] failed:", error);
      const message = error instanceof Error ? error.message : String(error);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
