import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/firebase/auth-middleware';
import { adminDb } from '@/lib/firebase/admin';
import { checkRateLimit } from '@/lib/firebase/rate-limit';
import { generateText, parseLLMJson } from '@/lib/vertex/client';
import { flags } from '@/lib/features/flags';
import { FORM_CHECK_SYSTEM_PROMPT } from '@/lib/features/form-check/prompts';
import { FormCheckResultSchema } from '@/lib/features/form-check/schema';
import { canAccessFeature } from '@/lib/stripe/subscription';

export async function POST(req: NextRequest) {
  if (!flags.formCheck()) {
    return NextResponse.json({ error: "Ce module n'est pas actif." }, { status: 403 });
  }

  return withAuth(req, async (_authReq, user) => {
    try {
      // Tier gating server-side (M12 = Premium+ in brief V2)
      const userSnap = await adminDb.collection('users').doc(user.uid).get();
      const subscription = userSnap.data()?.subscription;
      if (!canAccessFeature(subscription, 'premium')) {
        return NextResponse.json(
          { error: "Form check vidéo réservé aux abonnés Premium." },
          { status: 402 }
        );
      }

      // Premium = 5 form checks per month, Premium+ = unlimited
      const isPremiumPlus = subscription?.tier === 'premium_plus';
      if (!isPremiumPlus) {
        const monthlyKey = new Date().toISOString().slice(0, 7);
        const monthSnap = await adminDb
          .collection('users').doc(user.uid)
          .collection('form_checks')
          .where('month_key', '==', monthlyKey)
          .get();
        if (monthSnap.size >= 5) {
          return NextResponse.json(
            {
              error: 'Quota mensuel atteint (5 form checks). Passe Premium+ pour illimité.',
              quota_used: monthSnap.size,
              quota_max: 5,
            },
            { status: 429 }
          );
        }
      }

      // Soft rate-limit per-hour to prevent burst abuse
      const rl = await checkRateLimit(user.uid, { scope: 'ai_form_check', perHour: 5 });
      if (!rl.ok) {
        return NextResponse.json(
          { error: 'Trop de form checks récents. Patiente quelques minutes.', retryAfterSec: rl.retryAfterSec },
          { status: 429 }
        );
      }

      const { videoBase64, mimeType, exercise_name } = await req.json();
      if (!videoBase64) {
        return NextResponse.json({ error: 'Données de la vidéo manquantes.' }, { status: 400 });
      }

      const contents = [
        {
          role: 'user',
          parts: [
            { inlineData: { data: videoBase64, mimeType: mimeType || 'video/mp4' } },
            {
              text:
                `Analyse la technique de cet exercice${exercise_name ? ` (${exercise_name})` : ''} dans la vidéo ci-dessus.\n` +
                `Renvoie observations + recommandations + score 1-10 + alertes sécurité au format JSON requis.`,
            },
          ],
        },
      ];

      const responseText = await generateText({
        model: process.env.VERTEX_AI_MODEL_PRO || 'gemini-2.5-pro',
        contents,
        systemInstruction: FORM_CHECK_SYSTEM_PROMPT,
        temperature: 0.2,
        responseMimeType: 'application/json',
      });

      if (!responseText) {
        throw new Error("L'IA n'a retourné aucun résultat d'analyse.");
      }

      const parsedAnalysis = FormCheckResultSchema.parse(parseLLMJson(responseText));

      // Persist to users/{uid}/form_checks/{auto-id} per ADR-006
      const monthKey = new Date().toISOString().slice(0, 7);
      const docRef = await adminDb
        .collection('users').doc(user.uid)
        .collection('form_checks').add({
          exercise_name: exercise_name ?? null,
          analysis: parsedAnalysis,
          month_key: monthKey,
          tier_at_time: subscription?.tier ?? 'premium',
          analyzed_at: new Date().toISOString(),
        });

      return NextResponse.json(
        { success: true, id: docRef.id, analysis: parsedAnalysis },
        { status: 200 }
      );
    } catch (error) {
      console.error('Error in exercise form check API:', error);
      const errMsg = error instanceof Error ? error.message : String(error);
      return NextResponse.json(
        { error: "Impossible d'analyser le mouvement de l'exercice.", details: errMsg },
        { status: 500 }
      );
    }
  });
}
