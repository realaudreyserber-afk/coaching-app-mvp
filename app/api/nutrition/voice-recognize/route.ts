import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/firebase/auth-middleware';
import { generateText } from '@/lib/vertex/client';
import { flags } from '@/lib/features/flags';
import { VOICE_LOG_SYSTEM_PROMPT } from '@/lib/features/voice-log/prompts';
import { PhotoMealAnalysisSchema } from '@/lib/features/photo-meal/schema';

export async function POST(req: NextRequest) {
  // Check if feature flag is active
  if (!flags.voiceLog()) {
    return NextResponse.json(
      { error: "Ce module n'est pas actif." },
      { status: 403 }
    );
  }

  return withAuth(req, async (authenticatedReq, user) => {
    try {
      const formData = await req.formData();
      const audioFile = formData.get('audio') as File | null;

      if (!audioFile) {
        return NextResponse.json(
          { error: 'Fichier audio manquant.' },
          { status: 400 }
        );
      }

      // Convert file buffer to base64
      const arrayBuffer = await audioFile.arrayBuffer();
      const base64Audio = Buffer.from(arrayBuffer).toString('base64');
      const mimeType = audioFile.type || 'audio/webm';

      // Prepare contents for multimodal model
      const contents = [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                data: base64Audio,
                mimeType,
              },
            },
            {
              text: 'Écoute cet enregistrement audio et extrais-en les aliments consommés en JSON.',
            },
          ],
        },
      ];

      // Call Gemini Flash for fast audio understanding
      const responseText = await generateText({
        model: 'gemini-2.5-flash',
        contents,
        systemInstruction: VOICE_LOG_SYSTEM_PROMPT,
        temperature: 0.2,
        responseMimeType: 'application/json',
      });

      if (!responseText) {
        throw new Error("L'IA n'a retourné aucun aliment à partir de l'audio.");
      }

      // Parse & validate using the same Zod schema as Photo Meal (since formats are identical)
      const parsedAnalysis = PhotoMealAnalysisSchema.parse(JSON.parse(responseText));

      return NextResponse.json({
        success: true,
        analysis: parsedAnalysis,
      }, { status: 200 });

    } catch (error) {
      console.error('Error in voice logging API:', error);
      const errMsg = error instanceof Error ? error.message : String(error);
      return NextResponse.json(
        { error: 'Impossible de décoder ta commande vocale.', details: errMsg },
        { status: 500 }
      );
    }
  });
}
