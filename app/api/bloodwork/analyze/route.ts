import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/firebase/auth-middleware';
import { generateText } from '@/lib/vertex/client';
import { flags } from '@/lib/features/flags';
import { BLOODWORK_SYSTEM_PROMPT } from '@/lib/features/bloodwork-upload/prompts';
import { BloodworkAnalysisSchema } from '@/lib/features/bloodwork-upload/schema';

export async function POST(req: NextRequest) {
  // Check if feature flag is active
  if (!flags.bloodworkUpload()) {
    return NextResponse.json(
      { error: "Ce module n'est pas actif." },
      { status: 403 }
    );
  }

  return withAuth(req, async (authenticatedReq, user) => {
    try {
      const { fileBase64, mimeType } = await req.json();

      if (!fileBase64) {
        return NextResponse.json(
          { error: 'Données du document manquantes.' },
          { status: 400 }
        );
      }

      // Prepare contents for Gemini Pro (which handles documents extremely well)
      const contents = [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                data: fileBase64,
                mimeType: mimeType || 'application/pdf',
              },
            },
            {
              text: 'Analyse ce bilan sanguin, extrais-en tous les marqueurs de santé et leurs valeurs, et renvoie le rapport au format JSON requis.',
            },
          ],
        },
      ];

      // Call Gemini Pro
      const responseText = await generateText({
        model: 'gemini-2.5-pro',
        contents,
        systemInstruction: BLOODWORK_SYSTEM_PROMPT,
        temperature: 0.1,
        responseMimeType: 'application/json',
      });

      if (!responseText) {
        throw new Error("L'IA n'a retourné aucun résultat d'analyse.");
      }

      // Parse & validate with Zod
      const parsedAnalysis = BloodworkAnalysisSchema.parse(JSON.parse(responseText));

      return NextResponse.json({
        success: true,
        analysis: parsedAnalysis,
      }, { status: 200 });

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
