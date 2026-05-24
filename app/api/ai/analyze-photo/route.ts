import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminStorage } from '@/lib/firebase/admin';
import { withAuth } from '@/lib/firebase/auth-middleware';
import { checkRateLimit } from '@/lib/firebase/rate-limit';
import { generateText, parseLLMJson } from '@/lib/vertex/client';
import { VISION_ANALYSIS_SYSTEM_PROMPT } from '@/lib/vertex/prompts/vision-analysis';
import { VisionAnalysisSchema } from '@/lib/vertex/schemas';
import { VISION_ANALYSIS_RESPONSE_SCHEMA } from '@/lib/vertex/response-schemas';

interface AnalyzePhotoBody {
  storagePath: string;
  mimeType?: string;
  type?: 'face' | 'profile' | 'back';
  previousStoragePath?: string;
}

async function downloadAsBase64(path: string): Promise<{ base64: string; mime: string }> {
  const file = adminStorage.bucket().file(path);
  const [contents] = await file.download();
  const [metadata] = await file.getMetadata();
  return {
    base64: contents.toString('base64'),
    mime: (metadata.contentType as string) || 'image/jpeg',
  };
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (_authReq, user) => {
    try {
      const uid = user.uid;
      const rl = await checkRateLimit(uid, { scope: 'ai_analyze_photo', perHour: 10 });
      if (!rl.ok) {
        return NextResponse.json(
          { error: "Trop d'analyses photo récentes. Réessaye plus tard.", retryAfterSec: rl.retryAfterSec },
          { status: 429 }
        );
      }
      const body = (await req.json()) as AnalyzePhotoBody;
      if (!body.storagePath) {
        return NextResponse.json({ error: 'storagePath requis.' }, { status: 400 });
      }

      if (!body.storagePath.startsWith(`users/${uid}/`)) {
        return NextResponse.json({ error: 'Chemin de stockage non autorisé.' }, { status: 403 });
      }

      const currentImg = await downloadAsBase64(body.storagePath);
      const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [
        { text: 'Voici la photo de progrès actuelle.' },
        { inlineData: { mimeType: currentImg.mime, data: currentImg.base64 } },
      ];

      if (body.previousStoragePath && body.previousStoragePath.startsWith(`users/${uid}/`)) {
        const prevImg = await downloadAsBase64(body.previousStoragePath);
        parts.push({ text: 'Voici la photo précédente pour comparaison.' });
        parts.push({ inlineData: { mimeType: prevImg.mime, data: prevImg.base64 } });
      }

      const raw = await generateText({
        model: process.env.VERTEX_AI_MODEL_PRO || 'gemini-2.5-pro',
        contents: [{ role: 'user', parts }],
        systemInstruction: VISION_ANALYSIS_SYSTEM_PROMPT,
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: VISION_ANALYSIS_RESPONSE_SCHEMA,
      });

      const parsed = VisionAnalysisSchema.parse(parseLLMJson(raw));

      const photoDoc = await adminDb
        .collection('users').doc(uid)
        .collection('photos').add({
          type: body.type || 'face',
          storage_path: body.storagePath,
          bf_estimated: parsed.bf_estimated,
          quality_score: parsed.quality_score,
          analysis: parsed,
          date: new Date().toISOString().split('T')[0],
          created_at: new Date().toISOString(),
        });

      return NextResponse.json({
        success: true,
        photoId: photoDoc.id,
        analysis: parsed,
      }, { status: 200 });
    } catch (err) {
      console.error('analyze-photo error:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { error: "L'analyse photo a échoué.", details: errMsg },
        { status: 500 }
      );
    }
  });
}
