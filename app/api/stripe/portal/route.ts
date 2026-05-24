import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/firebase/auth-middleware';
import { adminDb } from '@/lib/firebase/admin';
import { getStripe, STRIPE_PORTAL_RETURN_URL } from '@/lib/stripe/server';

export async function POST(req: NextRequest) {
  return withAuth(req, async (_authReq, user) => {
    try {
      const userRef = adminDb.collection('users').doc(user.uid);
      const userSnap = await userRef.get();
      const customerId: string | undefined = userSnap.data()?.subscription?.stripe_customer_id;
      if (!customerId) {
        return NextResponse.json(
          { error: "Aucun abonnement Stripe trouvé pour ce compte." },
          { status: 404 }
        );
      }

      const stripe = getStripe();
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: STRIPE_PORTAL_RETURN_URL,
        locale: 'fr',
      });
      return NextResponse.json({ url: session.url });
    } catch (err) {
      console.error('Stripe portal error:', err);
      return NextResponse.json(
        { error: 'Impossible de charger le portail Stripe.' },
        { status: 500 }
      );
    }
  });
}
