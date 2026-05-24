import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/firebase/auth-middleware';
import { adminDb } from '@/lib/firebase/admin';
import { checkRateLimit } from '@/lib/firebase/rate-limit';
import { generateText, parseLLMJson } from '@/lib/vertex/client';
import { flags } from '@/lib/features/flags';
import { BLOODWORK_SYSTEM_PROMPT } from '@/lib/features/bloodwork-upload/prompts';
import { BloodworkAnalysisSchema } from '@/lib/features/bloodwork-upload/schema';

export async function POST(req: NextRequest) {
  if (!flags.bloodworkUpload()) {
    return NextResponse.json({ error: "Ce module n'est pas actif." }, { status: 403 });
  }

  return withAuth(req, async (_authReq, user) => {
    try {
      const rl = await checkRateLimit(user.uid, { scope: 'ai_bloodwork', perHour: 5 });
      if (!rl.ok) {
        return NextResponse.json(
          { error: "Trop d'analyses récentes. Réessaye plus tard.", retryAfterSec: rl.retryAfterSec },
          { status: 429 }
        );
      }

      const { fileBase64, mimeType } = await req.json();
      if (!fileBase64) {
        return NextResponse.json({ error: 'Données du document manquantes.' }, { status: 400 });
      }

      const contents = [
        {
          role: 'user',
          parts: [
            { inlineData: { data: fileBase64, mimeType: mimeType || 'application/pdf' } },
            { text: 'Analyse ce bilan sanguin, extrais-en tous les marqueurs de santé et leurs valeurs, et renvoie le rapport au format JSON requis.' },
          ],
        },
      ];

      const responseText = await generateText({
        model: process.env.VERTEX_AI_MODEL_PRO || 'gemini-2.5-pro',
        contents,
        systemInstruction: BLOODWORK_SYSTEM_PROMPT,
        temperature: 0.1,
        responseMimeType: 'application/json',
      });

      if (!responseText) {
        throw new Error("L'IA n'a retourné aucun résultat d'analyse.");
      }

      const parsedAnalysis = BloodworkAnalysisSchema.parse(parseLLMJson(responseText));

      // Persist to users/{uid}/bloodwork/{date} per ADR-006 (time-series sub-collection)
      const today = new Date().toISOString().split('T')[0];
      await adminDb
        .collection('users').doc(user.uid)
        .collection('bloodwork').doc(today)
        .set({
          date: today,
          summary: parsedAnalysis.summary,
          markers: parsedAnalysis.markers,
          analyzed_at: new Date().toISOString(),
        });

      // Update last_bloodwork_date in profile.medical for coach context lookups
      await adminDb.collection('users').doc(user.uid).update({
        'medical.last_bloodwork_date': today,
      });

      return NextResponse.json({ success: true, analysis: parsedAnalysis, date: today }, { status: 200 });
    } catch (error) {
      console.error('Error in bloodwork analysis API:', error);
      const errMsg = error instanceof Error ? error.message : String(error);
      return NextResponse.json(
        { error: 'Impossible de lire le document de bilan sanguin.', details: errMsg },
        { status: 500 }
      );
    }
  });
}
