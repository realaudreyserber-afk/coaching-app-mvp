import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/firebase/auth-middleware';
import { checkRateLimit } from '@/lib/firebase/rate-limit';
import { generateText } from '@/lib/vertex/client';
import { flags } from '@/lib/features/flags';
import { RECIPE_OCR_SYSTEM_PROMPT } from '@/lib/features/recipe-ocr/prompts';
import { RecipeOcrResultSchema } from '@/lib/features/recipe-ocr/schema';

export async function POST(req: NextRequest) {
  // Check if feature flag is active
  if (!flags.recipeOcr()) {
    return NextResponse.json(
      { error: "Ce module n'est pas actif." },
      { status: 403 }
    );
  }

  return withAuth(req, async (authenticatedReq, user) => {
    // Wave 13C — Cap Vertex Vision calls (Gemini Flash + image).
    const rl = await checkRateLimit(user.uid, { scope: 'nutrition_recipe_ocr', perMinute: 4, perHour: 20 });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'rate_limited', retry_after_sec: rl.retryAfterSec },
        { status: 429 },
      );
    }
    try {
      const { imageBase64, mimeType } = await req.json();

      if (!imageBase64) {
        return NextResponse.json(
          { error: 'Données de l\'image de recette manquantes.' },
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
              text: 'Lis cette photo de recette, extrais-en le texte structuré et estime les macros au format JSON requis.',
            },
          ],
        },
      ];

      // Call Gemini Flash (excellent and fast for OCR & document analysis)
      const responseText = await generateText({
        model: 'gemini-2.5-flash',
        contents,
        systemInstruction: RECIPE_OCR_SYSTEM_PROMPT,
        temperature: 0.1,
        responseMimeType: 'application/json',
      });

      if (!responseText) {
        throw new Error("L'IA n'a retourné aucun résultat d'analyse.");
      }

      // Parse & validate with Zod
      const parsedAnalysis = RecipeOcrResultSchema.parse(JSON.parse(responseText));

      return NextResponse.json({
        success: true,
        recipe: parsedAnalysis,
      }, { status: 200 });

    } catch (error) {
      console.error('Error in recipe OCR API:', error);
      const errMsg = error instanceof Error ? error.message : String(error);
      return NextResponse.json(
        { error: 'Impossible de lire la recette sur la photo.', details: errMsg },
        { status: 500 }
      );
    }
  });
}
