import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/firebase/auth-middleware';
import { generateText } from '@/lib/vertex/client';
import { flags } from '@/lib/features/flags';
import { PHOTO_MEAL_SYSTEM_PROMPT } from '@/lib/features/photo-meal/prompts';
import { PhotoMealAnalysisSchema } from '@/lib/features/photo-meal/schema';

export async function POST(req: NextRequest) {
  // Check if feature flag is active
  if (!flags.photoMeal()) {
    return NextResponse.json(
      { error: "Ce module n'est pas actif." },
      { status: 403 }
    );
  }

  return withAuth(req, async (authenticatedReq, user) => {
    try {
      const { imageBase64, mimeType } = await req.json();

      if (!imageBase64) {
        return NextResponse.json(
          { error: 'Données de l\'image manquantes.' },
          { status: 400 }
        );
      }

      // Prepare contents for multimodal model
      const contents = [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                data: imageBase64,
                mimeType: mimeType || 'image/jpeg',
              },
            },
            {
              text: 'Analyse la photo de ce repas, identifie les aliments et renvoie les calories/macros.',
            },
          ],
        },
      ];

      // Call Gemini Flash (excellent and fast for vision/classification tasks)
      const responseText = await generateText({
        model: 'gemini-2.5-flash',
        contents,
        systemInstruction: PHOTO_MEAL_SYSTEM_PROMPT,
        temperature: 0.2,
        responseMimeType: 'application/json',
      });

      if (!responseText) {
        throw new Error("L'IA n'a retourné aucun résultat d'analyse.");
      }

      // Parse & validate with Zod
      const parsedAnalysis = PhotoMealAnalysisSchema.parse(JSON.parse(responseText));

      return NextResponse.json({
        success: true,
        analysis: parsedAnalysis,
      }, { status: 200 });

    } catch (error) {
      console.error('Error in photo meal recognition API:', error);
      const errMsg = error instanceof Error ? error.message : String(error);
      return NextResponse.json(
        { error: 'Impossible d\'analyser la photo du repas.', details: errMsg },
        { status: 500 }
      );
    }
  });
}
