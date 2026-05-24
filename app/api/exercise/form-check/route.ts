import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/firebase/auth-middleware';
import { generateText } from '@/lib/vertex/client';
import { flags } from '@/lib/features/flags';
import { FORM_CHECK_SYSTEM_PROMPT } from '@/lib/features/form-check/prompts';
import { FormCheckResultSchema } from '@/lib/features/form-check/schema';

export async function POST(req: NextRequest) {
  // Check if feature flag is active
  if (!flags.formCheck()) {
    return NextResponse.json(
      { error: "Ce module n'est pas actif." },
      { status: 403 }
    );
  }

  return withAuth(req, async (authenticatedReq, user) => {
    try {
      const { videoBase64, mimeType } = await req.json();

      if (!videoBase64) {
        return NextResponse.json(
          { error: 'Données de la vidéo manquantes.' },
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
                data: videoBase64,
                mimeType: mimeType || 'video/mp4',
              },
            },
            {
              text: 'Analyse la technique de cet exercice dans la vidéo brute ci-dessus et renvoie les observations, recommandations, score et alertes de sécurité au format JSON requis.',
            },
          ],
        },
      ];

      // Call Gemini Pro (recommended for complex video movement analysis)
      const responseText = await generateText({
        model: 'gemini-2.5-pro',
        contents,
        systemInstruction: FORM_CHECK_SYSTEM_PROMPT,
        temperature: 0.2,
        responseMimeType: 'application/json',
      });

      if (!responseText) {
        throw new Error("L'IA n'a retourné aucun résultat d'analyse.");
      }

      // Parse & validate with Zod
      const parsedAnalysis = FormCheckResultSchema.parse(JSON.parse(responseText));

      return NextResponse.json({
        success: true,
        analysis: parsedAnalysis,
      }, { status: 200 });

    } catch (error) {
      console.error('Error in exercise form check API:', error);
      const errMsg = error instanceof Error ? error.message : String(error);
      return NextResponse.json(
        { error: 'Impossible d\'analyser le mouvement de l\'exercice.', details: errMsg },
        { status: 500 }
      );
    }
  });
}
