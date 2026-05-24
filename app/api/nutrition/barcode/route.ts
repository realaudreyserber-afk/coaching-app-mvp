import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/firebase/auth-middleware';
import { flags } from '@/lib/features/flags';
import { fetchFromOpenFoodFacts } from '@/lib/features/barcode/client';
import { adminDb } from '@/lib/firebase/admin';

export async function GET(req: NextRequest) {
  // Check if feature flag is active
  if (!flags.barcode()) {
    return NextResponse.json(
      { error: "Ce module n'est pas actif." },
      { status: 403 }
    );
  }

  return withAuth(req, async (authenticatedReq, user) => {
    try {
      const barcode = req.nextUrl.searchParams.get('code');
      if (!barcode) {
        return NextResponse.json(
          { error: 'Code-barres manquant dans la requête.' },
          { status: 400 }
        );
      }

      // If offDb flag is active, look up in Firestore cache first
      if (flags.offDb()) {
        try {
          const docRef = adminDb.collection('content').doc('foods').collection('items').doc(barcode);
          const docSnap = await docRef.get();

          if (docSnap.exists) {
            const data = docSnap.data();
            return NextResponse.json({ source: 'cache', food: data }, { status: 200 });
          }
        } catch (dbError) {
          console.warn('Error reading from content/foods Firestore cache:', dbError);
        }
      }

      // Fetch from Open Food Facts API
      const food = await fetchFromOpenFoodFacts(barcode);
      if (!food) {
        return NextResponse.json(
          { error: 'Produit introuvable dans la base de données alimentaire.' },
          { status: 404 }
        );
      }

      // Cache it in Firestore if offDb is active
      if (flags.offDb()) {
        try {
          const docRef = adminDb.collection('content').doc('foods').collection('items').doc(barcode);
          await docRef.set({
            ...food,
            updatedAt: new Date().toISOString(),
          });
        } catch (dbError) {
          console.warn('Error writing to content/foods Firestore cache:', dbError);
        }
      }

      return NextResponse.json({ source: 'api', food }, { status: 200 });
    } catch (error) {
      console.error('Error in barcode lookup API:', error);
      const errMsg = error instanceof Error ? error.message : String(error);
      return NextResponse.json(
        { error: 'Une erreur est survenue lors de la recherche du produit.', details: errMsg },
        { status: 500 }
      );
    }
  });
}
