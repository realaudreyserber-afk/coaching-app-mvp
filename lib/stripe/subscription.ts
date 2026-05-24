export type SubscriptionTier = 'free' | 'premium' | 'premium_plus' | 'paused';

export interface SubscriptionState {
  tier: SubscriptionTier;
  status?: string;
  stripe_customer_id?: string;
  stripe_sub_id?: string;
  current_period_end?: string;
}

export function isPremium(state: SubscriptionState | undefined | null): boolean {
  if (!state) return false;
  return state.tier === 'premium' || state.tier === 'premium_plus';
}

export function canAccessFeature(state: SubscriptionState | undefined | null, requiredTier: SubscriptionTier): boolean {
  if (!state) return requiredTier === 'free';
  const order: Record<SubscriptionTier, number> = {
    free: 0,
    paused: 0,
    premium: 1,
    premium_plus: 2,
  };
  return order[state.tier] >= order[requiredTier];
}
