/**
 * POST /api/ai/coach-progress-analysis
 *
 * No body required.
 *
 * Generates a short ORACLE.IA analysis of the athlete's progression over
 * the last 4 weeks: weight trend, measurement deltas, body scan diff,
 * top lifts, plateau detection.
 *
 * Used by /progress page — the user explicitly requests the analysis via a
 * button click. Cached for 6h to avoid reprompting on tab refresh.
 */
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { withAuth } from "@/lib/firebase/auth-middleware";
import { checkRateLimit } from "@/lib/firebase/rate-limit";
import { generateText } from "@/lib/vertex/client";
import { COACH_SYSTEM_PROMPT } from "@/lib/vertex/prompts/coach";

export const runtime = "nodejs";

const PROGRESS_INSTRUCTION = `Tu es ORACLE.IA, coach NoDream. Tu analyses la progression d'un athlète sur les 4 dernières semaines.

CONTRAINTES :
- 5 à 8 phrases FR, tutoiement, ton sec et factuel.
- Structure :
  1. Trend poids/composition (perte, gain, plateau)
  2. Évolution mesures clés (cou/taille/hanches) si data
  3. Évolution top lifts musculation si data
  4. Plateau détecté ? Hypothèse cause
  5. Recommandation concrète unique pour la semaine à venir
- Pas de flatterie creuse. Si peu de données, dis-le sec.
- Pas de markdown, pas de balise <COACH_SAVE>, pas de citation source.
- 150-220 mots max.`;

const CACHE_TTL_HOURS = 6;

export async function POST(req: NextRequest) {
  return withAuth(req, async (_authReq, user) => {
    try {
      const uid = user.uid;

      const rl = await checkRateLimit(uid, {
        scope: "ai_progress_analysis",
        perHour: 6,
        perMinute: 2,
      });
      if (!rl.ok) {
        return NextResponse.json(
          { error: "rate_limited", retry_after_sec: rl.retryAfterSec },
          { status: 429 },
        );
      }

      const userRef = adminDb.collection("users").doc(uid);

      // Cache lookup
      const cacheRef = userRef.collection("ai_cache").doc("progress_analysis");
      const cached = await cacheRef.get();
      if (cached.exists) {
        const data = cached.data();
        const ageMs = Date.now() - new Date(data?.generated_at ?? 0).getTime();
        if (ageMs < CACHE_TTL_HOURS * 3600 * 1000) {
          return NextResponse.json({
            ok: true,
            cached: true,
            analysis: data?.text,
            generated_at: data?.generated_at,
          });
        }
      }

      // Gather data : last 28d daily checkins, weekly checkins, body scans, sessions
      const cutoff = new Date(Date.now() - 28 * 24 * 3600 * 1000);
      const cutoffIso = cutoff.toISOString();
      const cutoffDate = cutoffIso.slice(0, 10);

      const [userSnap, dailyCheckinsSnap, weeklyCheckinsSnap, bodyScansSnap, sessionsSnap] =
        await Promise.all([
          userRef.get(),
          userRef
            .collection("checkins_daily")
            .where("created_at", ">=", cutoffIso)
            .orderBy("created_at", "asc")
            .get(),
          userRef
            .collection("checkins_weekly")
            .where("created_at", ">=", cutoffIso)
            .orderBy("created_at", "asc")
            .get(),
          userRef
            .collection("body_scans")
            .where("created_at", ">=", cutoffIso)
            .orderBy("created_at", "asc")
            .get(),
          userRef
            .collection("workout_sessions")
            .where("status", "==", "completed")
            .where("started_at", ">=", cutoffIso)
            .orderBy("started_at", "asc")
            .get(),
        ]);

      if (!userSnap.exists) {
        return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
      }
      const userData = userSnap.data() ?? {};

      const dailyWeights = dailyCheckinsSnap.docs
        .map((d) => ({ date: d.id, weight: d.data().weight as number | undefined }))
        .filter((d) => typeof d.weight === "number");

      const weeklyMeasures = weeklyCheckinsSnap.docs.map((d) => ({
        id: d.id,
        measurements: d.data().measurements,
        photos_present: !!(d.data().photos?.face || d.data().photos?.profile),
      }));

      const bodyScans = bodyScansSnap.docs.map((d) => ({
        date: ((d.data().created_at as string) ?? "").slice(0, 10),
        bf_pct: d.data().bf_pct,
        muscle_mass_kg: d.data().muscle_mass_kg,
      }));

      const sessions = sessionsSnap.docs.map((d) => {
        const s = d.data();
        return {
          date: ((s.started_at as string) ?? "").slice(0, 10),
          operation_name: s.operation_name,
          volume_kg: s.metrics?.volume_kg,
          completion_pct: s.metrics?.completion_pct,
        };
      });

      const ctx = {
        period: { since: cutoffDate, total_days: 28 },
        profile: {
          name: userData.profile?.name,
          sex: userData.profile?.sex,
          training_history: userData.profile?.training_history,
          training_environment: userData.profile?.training_environment,
        },
        baseline_weight_kg: userData.baseline?.weight,
        target_weight_kg: userData.goals?.target_weight,
        primary_goal: userData.goals?.primary_goal ?? userData.goals?.type,
        daily_weights_sample: dailyWeights.slice(-14), // last 14d
        weekly_measures_count: weeklyMeasures.length,
        body_scans: bodyScans,
        sessions_count: sessions.length,
        sessions_sample: sessions.slice(-6), // last 6
        last_session_summary: userData.last_session_summary,
      };

      const promptText = `Données progression 4 dernières semaines :\n${JSON.stringify(ctx, null, 2)}`;

      const analysis = await generateText({
        model: process.env.VERTEX_AI_MODEL_FLASH || "gemini-3.5-flash",
        contents: [{ role: "user", parts: [{ text: promptText }] }],
        systemInstruction: `${COACH_SYSTEM_PROMPT.slice(0, 2000)}\n\n${PROGRESS_INSTRUCTION}`,
        temperature: 0.4,
      });

      const text = (analysis ?? "").trim();
      if (!text) {
        return NextResponse.json({ error: "Empty analysis" }, { status: 502 });
      }

      await cacheRef.set({
        text,
        generated_at: new Date().toISOString(),
      });

      return NextResponse.json({ ok: true, cached: false, analysis: text });
    } catch (err) {
      console.error("[coach-progress-analysis] failed:", err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "internal_error" },
        { status: 500 },
      );
    }
  });
}
