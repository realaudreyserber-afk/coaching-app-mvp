import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { withAuth } from '@/lib/firebase/auth-middleware';
import { checkRateLimit } from '@/lib/firebase/rate-limit';
import { generateText, parseLLMJson } from '@/lib/vertex/client';
import { WEEKLY_REVIEW_SYSTEM_PROMPT } from '@/lib/vertex/prompts/weekly-review';
import { WeeklyReviewSchema } from '@/lib/vertex/schemas';
import { WEEKLY_REVIEW_RESPONSE_SCHEMA } from '@/lib/vertex/response-schemas';
import { fetchEnrichmentContext, extractPlanKcal } from '@/lib/vertex/context-fetcher';

export async function POST(req: NextRequest) {
  return withAuth(req, async (_authReq, user) => {
    try {
      const uid = user.uid;
      const rl = await checkRateLimit(uid, { scope: 'ai_weekly_review', perHour: 5 });
      if (!rl.ok) {
        return NextResponse.json(
          { error: 'Trop de bilans récents. Patiente avant de relancer.', retryAfterSec: rl.retryAfterSec },
          { status: 429 }
        );
      }
      const userRef = adminDb.collection('users').doc(uid);
      const userSnap = await userRef.get();
      if (!userSnap.exists) {
        return NextResponse.json({ error: 'Profil introuvable.' }, { status: 404 });
      }
      const userData = userSnap.data() || {};

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sinceStr = sevenDaysAgo.toISOString().split('T')[0];

      const dailySnap = await userRef
        .collection('checkins_daily')
        .where('date', '>=', sinceStr)
        .orderBy('date', 'asc')
        .get();

      const dailyData = dailySnap.docs.map(d => d.data());

      const planSnap = await userRef
        .collection('plans')
        .where('active', '==', true)
        .limit(1)
        .get();
      const activePlan = planSnap.empty ? null : planSnap.docs[0].data();

      const body = await req.json().catch(() => ({}));
      // Audit 2026-05-28 #8 : le client POST `{ checkin: {...}, week }`. L'ancienne
      // lecture `body.measurements`/`body.notes` (top-level) valait TOUJOURS
      // null/'' → l'IA n'analysait jamais les mensurations saisies. On lit
      // désormais sous `body.checkin` (fallback top-level pour rétro-compat).
      const checkin = body.checkin ?? {};
      const weeklyMeasurements = checkin.measurements ?? body.measurements ?? null;
      const userNotes = checkin.free_notes ?? checkin.notes ?? body.notes ?? '';

      // Enrichissement contextuel (Phase 1B) : last_session, streak, body_scan,
      // recent_form_checks. Permet à l'IA de référencer les sessions terminées
      // et les analyses techniques récentes dans son diagnostic.
      const enrichments = await fetchEnrichmentContext(uid, userData, extractPlanKcal(activePlan ?? undefined));

      const context = {
        profile: userData.profile,
        goals: userData.goals,
        baseline: userData.baseline,
        active_plan: activePlan,
        daily_checkins_7d: dailyData,
        weekly_measurements: weeklyMeasurements,
        user_notes: userNotes,
        last_session: enrichments.lastSessionSummary,
        streak: enrichments.streak,
        body_scan_recent: enrichments.bodyScanRecent,
        recent_form_checks: enrichments.recentFormChecks,
      };

      const raw = await generateText({
        model: process.env.VERTEX_AI_MODEL_PRO || 'gemini-3.5-flash',
        contents: [{ role: 'user', parts: [{ text: `Analyse cette semaine et propose un diagnostic :\n${JSON.stringify(context, null, 2)}` }] }],
        systemInstruction: WEEKLY_REVIEW_SYSTEM_PROMPT,
        temperature: 0.3,
        responseMimeType: 'application/json',
        responseSchema: WEEKLY_REVIEW_RESPONSE_SCHEMA,
      });

      const parsed = WeeklyReviewSchema.parse(parseLLMJson(raw));

      const yearWeek = (() => {
        const now = new Date();
        const onejan = new Date(now.getFullYear(), 0, 1);
        const week = Math.ceil(((now.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
        return `${now.getFullYear()}-W${String(week).padStart(2, '0')}`;
      })();
      // Audit #8 : utiliser le MÊME doc-id que le client (body.week via
      // getISOWeekString) — sinon l'IA écrit dans un doc différent du bilan
      // saisi. Fallback sur le calcul local si absent.
      const weekId = typeof body.week === 'string' && body.week ? body.week : yearWeek;

      // Audit #8 : NE PAS réécrire measurements/free_notes ici. Le client a déjà
      // persisté le payload complet (mensurations + photos + notes) dans ce doc.
      // L'ancienne écriture `measurements: weeklyMeasurements` (=null) avec
      // merge:true ÉCRASAIT les mensurations que l'user venait de saisir.
      // On n'ajoute que l'analyse IA.
      await userRef.collection('checkins_weekly').doc(weekId).set({
        week: weekId,
        ai_analysis: parsed,
        reviewed_at: new Date().toISOString(),
      }, { merge: true });

      return NextResponse.json({ success: true, review: parsed }, { status: 200 });
    } catch (err) {
      console.error('weekly-review error:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { error: 'Le bilan hebdomadaire a échoué.', details: errMsg },
        { status: 500 }
      );
    }
  });
}
