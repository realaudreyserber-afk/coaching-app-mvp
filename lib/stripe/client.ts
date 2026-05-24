import { loadStripe, Stripe } from '@stripe/stripe-js';

let cached: Promise<Stripe | null> | undefined;

export function getStripeClient(): Promise<Stripe | null> {
  if (cached) return cached;
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!key) {
    console.warn('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY non configuré');
    cached = Promise.resolve(null);
    return cached;
  }
  cached = loadStripe(key);
  return cached;
}
