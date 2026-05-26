/**
 * POST /api/coach/proactive
 *
 * Body: { trigger: 'welcome' | 'plan_generated' | 'session_finished' | 'plateau_detected' }
 *
 * Generates a proactive ORACLE.IA message and posts it as an assistant
 * message in users/{uid}/coach_messages. Marks coach_state.has_unread_intervention
 * so /dashboard surfaces a badge.
 *
 * Idempotent guards:
 *  - welcome : only fires if coach_state.welcome_sent === false → flips to true
 *  - plan_generated : only fires if coach_state.plan_debrief_sent === false
 *  - others : always fires (each session_finished is unique)
 *
 * Called by:
 *  - /onboarding/[step] step 6 finish (welcome + plan_generated combined)
 *  - /api/sessions/[id]/finish post-success (session_finished)
 *  - Cloud Function plateau detection (future)
 */
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { withAuth } from '@/lib/firebase/auth-middleware';
import { checkRateLimit } from '@/lib/firebase/rate-limit';
import { generateText } from '@/lib/vertex/client';
import { COACH_SYSTEM_PROMPT } from '@/lib/vertex/prompts/coach';
import { loadCoachState, patchCoachState, markCoachIntervention } from '@/lib/features/coach-state/store';

export const runtime = 'nodejs';

const PROACTIVE_INSTRUCTIONS: Record<string, string> = {
  welcome: `Tu démarres la conversation avec un utilisateur qui vient de finir l'onboarding NoDream. Message court (50-90 mots), tutoiement, ton tactical sec. Présente-toi en 1 phrase ("Je suis ORACLE.IA, coach NoDream"), récapitule en 1 phrase ce que tu as compris de son profil (sexe, âge, objectif), pose UNE question d'ouverture précise pour le faire bouger (ex : "tu as déjà mesuré ton BF avec une méthode autre que la balance ?"). Pas de checklist, pas de "bienvenue" creux. Ne demande pas plusieurs choses à la fois.`,
  plan_generated: `L'utilisateur vient de recevoir son premier plan généré. Tu commentes le plan en 70-120 mots : annonce la cible kcal + macros, explique la stratégie (déficit/maintenance/surplus + ratio macros + cardio), termine par 1 phrase actionnable pour la première semaine. Tutoiement, ton sec, factuel, pas de flatterie.`,
  session_finished: `L'utilisateur vient de terminer une séance de musculation. Message court (40-70 mots) : reconnais la séance, mentionne un point factuel (top lift OU complétion OU progression), termine par 1 conseil micro pour la récup (étirements, hydratation, sommeil). Tutoiement, ton sec.`,
  plateau_detected: `Le poids de l'utilisateur stagne depuis 14+ jours. Message direct (60-100 mots) : reconnais le plateau sans dramatiser, propose 1 hypothèse concrète à vérifier (déficit insuffisant, sommeil dégradé, surévaluation activité), suggère 1 action précise (recalibrer TDEE adaptatif, ajouter cardio LISS, recompter macros sur 3 jours). Pas de "ne lâche rien".`,
};

interface ProactiveBody {
  trigger: 'welcome' | 'plan_generated' | 'session_finished' | 'plateau_detected';
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (_authReq, user) => {
    const uid = user.uid;

    const rl = await checkRateLimit(uid, {
      scope: 'coach_proactive',
      perMinute: 3,
      perHour: 15,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'rate_limited', retry_after_sec: rl.retryAfterSec },
        { status: 429 },
      );
    }

    let body: ProactiveBody;
    try {
      body = (await req.json()) as ProactiveBody;
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
    }
    const instruction = PROACTIVE_INSTRUCTIONS[body.trigger];
    if (!instruction) {
      return NextResponse.json({ error: 'unknown_trigger' }, { status: 400 });
    }

    const state = await loadCoachState(uid);

    // Idempotency guards
    if (body.trigger === 'welcome' && state.welcome_sent) {
      return NextResponse.json({ ok: true, skipped: 'welcome_already_sent' });
    }
    if (body.trigger === 'plan_generated' && state.plan_debrief_sent) {
      return NextResponse.json({ ok: true, skipped: 'plan_debrief_already_sent' });
    }

    // Load minimal context for the model
    const userRef = adminDb.collection('users').doc(uid);
    const [userSnap, plansSnap] = await Promise.all([
      userRef.get(),
      userRef.collection('plans').where('active', '==', true).limit(1).get(),
    ]);
    const userData = userSnap.data() ?? {};
    const activePlan = plansSnap.empty ? undefined : plansSnap.docs[0].data();

    const ctx = {
      profile: {
        name: userData.profile?.name,
        sex: userData.profile?.sex,
        age: userData.profile?.age,
        training_history: userData.profile?.training_history,
        training_environment: userData.profile?.training_environment,
      },
      goals: userData.goals,
      baseline: userData.baseline,
      active_plan: activePlan
        ? {
            kcal: activePlan.kcal,
            macros: activePlan.macros,
            cardio_type: activePlan.cardio?.type,
            cardio_freq: activePlan.cardio?.frequency_weekly,
            sessions_count: activePlan.training?.sessions?.length,
          }
        : undefined,
    };

    const text = await generateText({
      model: process.env.VERTEX_AI_MODEL_FLASH || 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: `Contexte :\n${JSON.stringify(ctx, null, 2)}` }] }],
      systemInstruction: `${COACH_SYSTEM_PROMPT.slice(0, 2500)}\n\n${instruction}`,
      temperature: 0.55,
    });

    const cleaned = (text ?? '').trim().slice(0, 1500);
    if (!cleaned) {
      return NextResponse.json({ error: 'empty_message' }, { status: 502 });
    }

    // Persist as an assistant message — appears next time user opens /coach
    const now = new Date().toISOString();
    await userRef.collection('coach_messages').add({
      role: 'assistant',
      content: cleaned,
      timestamp: now,
      proactive: true,
      trigger: body.trigger,
    });

    // Flip idempotency flags + mark unread badge
    const statePatch: Record<string, unknown> = {};
    if (body.trigger === 'welcome') statePatch.welcome_sent = true;
    if (body.trigger === 'plan_generated') statePatch.plan_debrief_sent = true;
    await patchCoachState(uid, statePatch);
    await markCoachIntervention(uid, {
      markUnread: true,
      topic: `proactive_${body.trigger}`,
    });

    return NextResponse.json({ ok: true, message: cleaned });
  });
}
