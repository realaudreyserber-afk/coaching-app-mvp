import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { withAuth } from '@/lib/firebase/auth-middleware';
import { checkRateLimit } from '@/lib/firebase/rate-limit';
import { generateText, parseLLMJson } from '@/lib/vertex/client';
import { DAILY_INSIGHT_SYSTEM_PROMPT } from '@/lib/vertex/prompts/daily-insight';
import { DailyInsightSchema } from '@/lib/vertex/schemas';
import { DAILY_INSIGHT_RESPONSE_SCHEMA } from '@/lib/vertex/response-schemas';
import { fetchEnrichmentContext, extractPlanKcal } from '@/lib/vertex/context-fetcher';

export async function POST(req: NextRequest) {
  return withAuth(req, async (_authReq, user) => {
    try {
      const uid = user.uid;
      const rl = await checkRateLimit(uid, { scope: 'ai_daily_insight', perMinute: 5, perHour: 30 });
      if (!rl.ok) {
        return NextResponse.json(
          { error: "Trop d'insights récents. Réessaye plus tard.", retryAfterSec: rl.retryAfterSec },
          { status: 429 }
        );
      }
      const userRef = adminDb.collection('users').doc(uid);
      const userSnap = await userRef.get();
      if (!userSnap.exists) {
        return NextResponse.json({ error: 'Profil introuvable.' }, { status: 404 });
      }

      const today = new Date().toISOString().split('T')[0];
      const checkinSnap = await userRef.collection('checkins_daily').doc(today).get();
      if (!checkinSnap.exists) {
        return NextResponse.json({
          error: "Aucun check-in pour aujourd'hui. Saisis-le d'abord.",
        }, { status: 404 });
      }

      // Enrichissement contextuel (Phase 1B) : on charge plan actif + enrichments
      // (last_session, streak, today_food, body_scan, wearables) pour que l'IA
      // génère un insight référencé aux vraies données, pas générique.
      const userData = userSnap.data() ?? {};
      const activePlanSnap = await userRef.collection('plans').where('active', '==', true).limit(1).get();
      const activePlan = activePlanSnap.empty ? undefined : activePlanSnap.docs[0].data();
      const enrichments = await fetchEnrichmentContext(uid, userData, extractPlanKcal(activePlan));

      const ctx = {
        profile: userData.profile,
        baseline: userData.baseline,
        goals: userData.goals,
        active_plan: activePlan
          ? { kcal: activePlan.kcal, macros: activePlan.macros, cardio_type: activePlan.cardio?.type }
          : undefined,
        checkin_today: checkinSnap.data(),
        last_session: enrichments.lastSessionSummary,
        streak: enrichments.streak,
        today_food: enrichments.todayFoodLogs,
        body_scan_recent: enrichments.bodyScanRecent,
        wearables_today: enrichments.wearablesToday,
      };

      const raw = await generateText({
        model: process.env.VERTEX_AI_MODEL_FLASH || 'gemini-3.5-flash',
        contents: [{ role: 'user', parts: [{ text: `Données du jour :\n${JSON.stringify(ctx, null, 2)}` }] }],
        systemInstruction: DAILY_INSIGHT_SYSTEM_PROMPT,
        temperature: 0.5,
        responseMimeType: 'application/json',
        responseSchema: DAILY_INSIGHT_RESPONSE_SCHEMA,
      });

      const parsed = DailyInsightSchema.parse(parseLLMJson(raw));

      await userRef.collection('insights_daily').doc(today).set({
        date: today,
        ...parsed,
        created_at: new Date().toISOString(),
      });

      return NextResponse.json({ success: true, ...parsed }, { status: 200 });
    } catch (err) {
      console.error('daily-insight error:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { error: "L'insight du jour a échoué.", details: errMsg },
        { status: 500 }
      );
    }
  });
}
