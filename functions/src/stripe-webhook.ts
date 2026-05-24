import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import Stripe from 'stripe';

const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');

export const stripeWebhook = onRequest(
  {
    region: 'europe-west1',
    memory: '512MiB',
    timeoutSeconds: 60,
    secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET],
  },
  async (req, res) => {
    const sig = req.headers['stripe-signature'];
    if (!sig || typeof sig !== 'string') {
      res.status(400).send('Missing stripe-signature header');
      return;
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY.value());
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        (req as unknown as { rawBody: Buffer }).rawBody,
        sig,
        STRIPE_WEBHOOK_SECRET.value()
      );
    } catch (err) {
      logger.error('Stripe webhook signature verification failed:', err);
      res.status(400).send('Invalid signature');
      return;
    }

    const db = getFirestore();

    const dedupeRef = db.collection('_stripe_events').doc(event.id);
    const alreadyProcessed = await db.runTransaction(async (tx) => {
      const snap = await tx.get(dedupeRef);
      if (snap.exists) return true;
      tx.set(dedupeRef, {
        type: event.type,
        received_at: new Date().toISOString(),
      });
      return false;
    });

    if (alreadyProcessed) {
      logger.info(`Stripe event ${event.id} already processed, skipping.`);
      res.status(200).json({ received: true, deduplicated: true });
      return;
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          const uid = session.metadata?.uid;
          if (uid && session.subscription) {
            await db.collection('users').doc(uid).update({
              'subscription.tier': 'premium',
              'subscription.stripe_customer_id': session.customer as string,
              'subscription.stripe_sub_id': session.subscription as string,
              'subscription.activated_at': new Date().toISOString(),
            });
          }
          break;
        }
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
          const sub = event.data.object as Stripe.Subscription;
          const usersSnap = await db.collection('users')
            .where('subscription.stripe_sub_id', '==', sub.id)
            .limit(1)
            .get();
          if (!usersSnap.empty) {
            const userRef = usersSnap.docs[0].ref;
            const tier =
              sub.status === 'active' || sub.status === 'trialing'
                ? 'premium'
                : sub.status === 'paused'
                ? 'paused'
                : 'free';
            await userRef.update({
              'subscription.tier': tier,
              'subscription.status': sub.status,
              'subscription.current_period_end': new Date(((sub.items.data[0] as unknown) as { current_period_end: number }).current_period_end * 1000).toISOString(),
            });
          }
          break;
        }
        case 'invoice.payment_failed': {
          const invoice = event.data.object as Stripe.Invoice;
          logger.warn(`Payment failed for customer ${invoice.customer}`);
          break;
        }
        default:
          logger.info(`Unhandled Stripe event: ${event.type}`);
      }

      res.status(200).json({ received: true });
    } catch (err) {
      logger.error('Stripe webhook handler error:', err);
      res.status(500).send('Webhook handler failed');
    }
  }
);
