import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/firebase/auth-middleware';
import { checkRateLimit } from '@/lib/firebase/rate-limit';
import { generateText, parseLLMJson } from '@/lib/vertex/client';
import { flags } from '@/lib/features/flags';
import { PHOTO_MEAL_SYSTEM_PROMPT } from '@/lib/features/photo-meal/prompts';
import { PhotoMealAnalysisSchema } from '@/lib/features/photo-meal/schema';
import { PHOTO_MEAL_RESPONSE_SCHEMA } from '@/lib/vertex/photo-meal-schema';

export async function POST(req: NextRequest) {
  if (!flags.photoMeal()) {
    return NextResponse.json({ error: "Ce module n'est pas actif." }, { status: 403 });
  }

  return withAuth(req, async (_authReq, user) => {
    try {
      const rl = await checkRateLimit(user.uid, {
        scope: 'ai_photo_meal',
        perHour: 20,
      });
      if (!rl.ok) {
        return NextResponse.json(
          { error: "Trop d'analyses photo récentes. Réessaye dans quelques minutes.", retryAfterSec: rl.retryAfterSec },
          { status: 429 }
        );
      }

      const { imageBase64, mimeType } = await req.json();
      if (!imageBase64) {
        return NextResponse.json({ error: "Données de l'image manquantes." }, { status: 400 });
      }

      const contents = [
        {
          role: 'user',
          parts: [
            { inlineData: { data: imageBase64, mimeType: mimeType || 'image/jpeg' } },
            {
              text:
                'Analyse la photo de ce repas, identifie chaque aliment visible avec sa quantité estimée en grammes ' +
                'et calcule les calories + macros (P/C/F). Renvoie un score de confiance par item.',
            },
          ],
        },
      ];

      const responseText = await generateText({
        model: process.env.VERTEX_AI_MODEL_FLASH || 'gemini-2.5-flash',
        contents,
        systemInstruction: PHOTO_MEAL_SYSTEM_PROMPT,
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: PHOTO_MEAL_RESPONSE_SCHEMA,
      });

      if (!responseText) {
        throw new Error("L'IA n'a retourné aucun résultat d'analyse.");
      }

      const parsedAnalysis = PhotoMealAnalysisSchema.parse(parseLLMJson(responseText));

      return NextResponse.json({ success: true, analysis: parsedAnalysis }, { status: 200 });
    } catch (error) {
      console.error('Error in photo meal recognition API:', error);
      const errMsg = error instanceof Error ? error.message : String(error);
      return NextResponse.json(
        { error: "Impossible d'analyser la photo du repas.", details: errMsg },
        { status: 500 }
      );
    }
  });
}
