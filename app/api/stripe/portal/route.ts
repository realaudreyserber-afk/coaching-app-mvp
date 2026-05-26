import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/firebase/auth-middleware';
import { checkRateLimit } from '@/lib/firebase/rate-limit';
import { adminDb } from '@/lib/firebase/admin';
import { getStripe, STRIPE_PORTAL_RETURN_URL } from '@/lib/stripe/server';

export async function POST(req: NextRequest) {
  return withAuth(req, async (_authReq, user) => {
    // Wave 13C — Cap Stripe portal session creation.
    const rl = await checkRateLimit(user.uid, { scope: 'stripe_portal', perHour: 10 });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'rate_limited', retry_after_sec: rl.retryAfterSec },
        { status: 429 },
      );
    }
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
