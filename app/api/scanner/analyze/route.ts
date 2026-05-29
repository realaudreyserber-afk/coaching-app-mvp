import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/firebase/auth-middleware';
import { adminDb, adminStorage } from '@/lib/firebase/admin';
import { checkRateLimit } from '@/lib/firebase/rate-limit';
import { generateText, parseLLMJson } from '@/lib/vertex/client';
import { flags } from '@/lib/features/flags';
import { BODY_SCANNER_SYSTEM_PROMPT } from '@/lib/features/body-scanner/prompts';
import { BodyScannerAnalysisSchema } from '@/lib/features/body-scanner/schema';
import { BODY_SCANNER_RESPONSE_SCHEMA } from '@/lib/vertex/body-scanner-schema';
import { serverHasAccess } from '@/lib/stripe/subscription';

interface ImagePart {
  inlineData: { data: string; mimeType: string };
}

async function downloadImagePart(path: string): Promise<ImagePart | null> {
  try {
    const file = adminStorage.bucket().file(path);
    const [contents] = await file.download();
    const [metadata] = await file.getMetadata();
    return {
      inlineData: {
        data: contents.toString('base64'),
        mimeType: (metadata.contentType as string) || 'image/jpeg',
      },
    };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  if (!flags.bodyScanner()) {
    return NextResponse.json({ error: "Ce module n'est pas actif." }, { status: 403 });
  }

  return withAuth(req, async (_authReq, user) => {
    try {
      const uid = user.uid;
      const userRef = adminDb.collection('users').doc(uid);

      // Garde d'accès (essai/premium ; no-op tant que le paywall n'est pas
      // activé). Trial-aware : un user en essai y a accès.
      const userSnap = await userRef.get();
      const subscription = userSnap.data()?.subscription;
      if (!serverHasAccess(subscription)) {
        return NextResponse.json(
          { error: "Body scanner réservé aux abonnés (essai ou Premium)." },
          { status: 402 }
        );
      }

      const rl = await checkRateLimit(uid, { scope: 'ai_body_scanner', perHour: 3 });
      if (!rl.ok) {
        return NextResponse.json(
          { error: 'Trop de scans récents. Patiente avant de relancer.', retryAfterSec: rl.retryAfterSec },
          { status: 429 }
        );
      }

      const { images, mimeTypes, storage_paths } = await req.json();
      if (!images || !Array.isArray(images) || images.length < 4) {
        return NextResponse.json(
          { error: 'Les 4 photos standardisées (Face, Dos, Profil G, Profil D) sont requises.' },
          { status: 400 }
        );
      }

      const currentImageParts: ImagePart[] = images.map((base64Data: string, index: number) => ({
        inlineData: {
          data: base64Data,
          mimeType: (mimeTypes && mimeTypes[index]) || 'image/jpeg',
        },
      }));

      // Fetch last scan: load its 4 photos from Storage for true image-to-image comparison
      const prevImageParts: ImagePart[] = [];
      let previousScanContext = 'Aucun scan précédent enregistré.';
      let previousDate: string | null = null;
      try {
        const scansSnap = await userRef
          .collection('body_scans')
          .orderBy('created_at', 'desc')
          .limit(1)
          .get();
        if (!scansSnap.empty) {
          const prevDoc = scansSnap.docs[0];
          previousDate = prevDoc.id;
          const prev = prevDoc.data();
          previousScanContext = `
Dernier scan le ${previousDate} :
- BF% estimé : ${prev.bf_pct_estimated}%
- Morphologie : ${prev.morphology_notes?.join(', ') || 'N/A'}
- Posture : ${prev.posture_observations?.join(', ') || 'N/A'}
`;

          const prevPaths: string[] = prev.storage_paths ?? [];
          for (const path of prevPaths.slice(0, 4)) {
            if (typeof path !== 'string') continue;
            if (!path.startsWith(`users/${uid}/`)) continue;
            const part = await downloadImagePart(path);
            if (part) prevImageParts.push(part);
          }
        }
      } catch (dbError) {
        console.warn('Error fetching previous scan:', dbError);
      }

      const hasComparablePhotos = prevImageParts.length >= 2;
      const textInstruction = hasComparablePhotos
        ? `Voici les 4 photos actuelles (Face, Dos, Profil G, Profil D), suivies des ${prevImageParts.length} photos du scan précédent (${previousDate}).\nCompare image-par-image pour évaluer l'évolution morphologique, posturale, et la composition corporelle.\n\nContexte précédent :\n${previousScanContext}`
        : `Voici les 4 photos actuelles (Face, Dos, Profil G, Profil D).\n${previousScanContext}`;

      const contents = [
        {
          role: 'user',
          parts: [
            ...currentImageParts,
            ...prevImageParts,
            { text: textInstruction },
          ],
        },
      ];

      const responseText = await generateText({
        model: process.env.VERTEX_AI_MODEL_PRO || 'gemini-2.5-pro',
        contents,
        systemInstruction: BODY_SCANNER_SYSTEM_PROMPT,
        temperature: 0.3,
        responseMimeType: 'application/json',
        responseSchema: BODY_SCANNER_RESPONSE_SCHEMA,
      });

      if (!responseText) {
        throw new Error("L'analyse morphologique n'a renvoyé aucune réponse.");
      }

      const parsedAnalysis = BodyScannerAnalysisSchema.parse(parseLLMJson(responseText));

      const todayStr = new Date().toISOString().split('T')[0];

      await userRef.collection('body_scans').doc(todayStr).set({
        ...parsedAnalysis,
        storage_paths: Array.isArray(storage_paths) ? storage_paths.slice(0, 4) : [],
        previous_scan_date: previousDate,
        photos_compared: hasComparablePhotos ? prevImageParts.length : 0,
        created_at: new Date().toISOString(),
      });

      return NextResponse.json(
        {
          success: true,
          date: todayStr,
          analysis: parsedAnalysis,
          compared_with: previousDate,
        },
        { status: 200 }
      );
    } catch (error) {
      console.error('Body scanner analysis error:', error);
      const errMsg = error instanceof Error ? error.message : String(error);
      return NextResponse.json(
        { error: "Impossible de réaliser l'analyse corporelle.", details: errMsg },
        { status: 500 }
      );
    }
  });
}
