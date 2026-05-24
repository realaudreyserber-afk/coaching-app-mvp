import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/firebase/auth-middleware';
import { adminDb } from '@/lib/firebase/admin';
import { getStripe, STRIPE_PRICE_IDS } from '@/lib/stripe/server';

export async function POST(req: NextRequest) {
  return withAuth(req, async (_authReq, user) => {
    try {
      const { interval } = await req.json().catch(() => ({ interval: 'monthly' }));
      const priceId =
        interval === 'yearly' ? STRIPE_PRICE_IDS.yearly : STRIPE_PRICE_IDS.monthly;

      if (!priceId) {
        return NextResponse.json(
          { error: 'Prix Stripe non configuré (STRIPE_PRICE_ID_* manquant).' },
          { status: 500 }
        );
      }

      const stripe = getStripe();
      const userRef = adminDb.collection('users').doc(user.uid);

      let customerId: string | undefined = await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(userRef);
        const existing = snap.data()?.subscription?.stripe_customer_id as string | undefined;
        if (existing) return existing;
        tx.set(userRef, { subscription: { stripe_customer_creating: true } }, { merge: true });
        return undefined;
      });

      if (!customerId) {
        try {
          const idempotencyKey = `customer_create_${user.uid}`;
          const customer = await stripe.customers.create(
            {
              email: user.email,
              metadata: { uid: user.uid },
            },
            { idempotencyKey }
          );
          customerId = customer.id;
          await userRef.set(
            {
              subscription: {
                stripe_customer_id: customerId,
                stripe_customer_creating: false,
              },
            },
            { merge: true }
          );
        } catch (createErr) {
          await userRef.set(
            { subscription: { stripe_customer_creating: false } },
            { merge: true }
          ).catch(() => {});
          throw createErr;
        }
      }

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${baseUrl}/settings/subscription?status=success`,
        cancel_url: `${baseUrl}/settings/subscription?status=cancelled`,
        metadata: { uid: user.uid },
        subscription_data: {
          metadata: { uid: user.uid },
        },
        allow_promotion_codes: true,
        locale: 'fr',
      });

      return NextResponse.json({ url: session.url });
    } catch (err) {
      console.error('Stripe checkout error:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { error: "Impossible d'initier l'abonnement.", details: errMsg },
        { status: 500 }
      );
    }
  });
}
