import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/firebase/auth-middleware';
import { generateText } from '@/lib/vertex/client';
import { flags } from '@/lib/features/flags';
import { BODY_SCANNER_SYSTEM_PROMPT } from '@/lib/features/body-scanner/prompts';
import { BodyScannerAnalysisSchema } from '@/lib/features/body-scanner/schema';
import { adminDb } from '@/lib/firebase/admin';

export async function POST(req: NextRequest) {
  // Check feature flag
  if (!flags.bodyScanner()) {
    return NextResponse.json(
      { error: "Ce module n'est pas actif." },
      { status: 403 }
    );
  }

  return withAuth(req, async (authenticatedReq, user) => {
    try {
      const uid = user.uid;
      const { images, mimeTypes } = await req.json(); // images is an array of 4 base64 strings: [front, back, left, right]

      if (!images || !Array.isArray(images) || images.length < 4) {
        return NextResponse.json(
          { error: 'Les 4 photos standardisées (Face, Dos, Profil G, Profil D) sont requises.' },
          { status: 400 }
        );
      }

      const userRef = adminDb.collection('users').doc(uid);

      // Fetch the last body scan to provide context for comparative analysis
      let previousScanContext = "Aucun scan précédent enregistré.";
      try {
        const scansSnap = await userRef.collection('body_scans')
          .orderBy('createdAt', 'desc')
          .limit(1)
          .get();

        if (!scansSnap.empty) {
          const prev = scansSnap.docs[0].data();
          previousScanContext = `
Dernier scan effectué le ${scansSnap.docs[0].id} :
- Masse grasse estimée : ${prev.bf_pct_estimated}%
- Notes morphologiques : ${prev.morphology_notes?.join(', ') || 'N/A'}
- Observations posturales : ${prev.posture_observations?.join(', ') || 'N/A'}
`;
        }
      } catch (dbError) {
        console.warn('Error fetching previous scans:', dbError);
      }

      // Format parts with all 4 images + text instructions
      const imageParts = images.map((base64Data, index) => ({
        inlineData: {
          data: base64Data,
          mimeType: (mimeTypes && mimeTypes[index]) || 'image/jpeg'
        }
      }));

      const textInstruction = `
Voici les 4 photos actuelles (Face, Dos, Profil Gauche, Profil Droit).
Compare-les avec le contexte suivant du scan précédent pour évaluer ma transformation et ma posture :
${previousScanContext}
`;

      const contents = [
        {
          role: 'user',
          parts: [
            ...imageParts,
            { text: textInstruction }
          ]
        }
      ];

      // Call Gemini Pro for highly detailed image-to-image morphological analysis
      const responseText = await generateText({
        model: process.env.VERTEX_AI_MODEL_PRO || 'gemini-2.5-pro',
        contents,
        systemInstruction: BODY_SCANNER_SYSTEM_PROMPT,
        temperature: 0.3,
        responseMimeType: 'application/json',
      });

      if (!responseText) {
        throw new Error("L'analyse morphologique n'a renvoyé aucune réponse.");
      }

      // Parse & Validate
      const parsedAnalysis = BodyScannerAnalysisSchema.parse(JSON.parse(responseText));

      const todayStr = new Date().toISOString().split('T')[0];

      // Save report in Firestore
      await userRef.collection('body_scans').doc(todayStr).set({
        ...parsedAnalysis,
        createdAt: new Date().toISOString(),
      });

      return NextResponse.json({
        success: true,
        date: todayStr,
        analysis: parsedAnalysis,
      }, { status: 200 });

    } catch (error) {
      console.error('Body scanner analysis error:', error);
      const errMsg = error instanceof Error ? error.message : String(error);
      return NextResponse.json(
        { error: 'Impossible de réaliser l\'analyse corporelle.', details: errMsg },
        { status: 500 }
      );
    }
  });
}
