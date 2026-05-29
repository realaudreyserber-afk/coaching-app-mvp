export type SubscriptionTier = 'free' | 'premium' | 'premium_plus' | 'paused';

export interface SubscriptionState {
  tier: SubscriptionTier;
  status?: string;
  stripe_customer_id?: string;
  stripe_sub_id?: string;
  current_period_end?: string;
  /** Essai gratuit (modèle 14 j → paywall). Posé au 1er plan généré. */
  trial_started_at?: string;
  trial_ends_at?: string;
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

// ─────────────────────────────────────────────────────────────────────────
// Modèle d'accès "essai 14 j → paywall" (monétisation)
// ─────────────────────────────────────────────────────────────────────────

/** Le paywall est-il activé ? Tant que ce flag est off, AUCUN gating (l'app
 * reste en accès libre). On l'active (NEXT_PUBLIC_ENABLE_PAYWALL=1) une fois
 * le prix Stripe configuré, sinon un user en fin d'essai serait bloqué sans
 * pouvoir payer. Lisible client (NEXT_PUBLIC) ET serveur. */
export function isPaywallEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_PAYWALL === '1';
}

export interface AccessState {
  isPremium: boolean;
  isInTrial: boolean;
  /** premium OU essai en cours */
  hasAccess: boolean;
  /** essai terminé sans paiement (et pas premium) → paywall */
  locked: boolean;
  trialDaysLeft: number;
}

/** Calcule l'état d'accès à partir de l'abonnement. Pur + testable. */
export function computeAccess(
  state: SubscriptionState | undefined | null,
  nowMs: number = Date.now(),
): AccessState {
  const premium = isPremium(state);
  const endsMs = state?.trial_ends_at ? Date.parse(state.trial_ends_at) : NaN;
  const isInTrial = Number.isFinite(endsMs) && nowMs < endsMs;
  const trialDaysLeft = isInTrial ? Math.ceil((endsMs - nowMs) / 86_400_000) : 0;
  const hasAccess = premium || isInTrial;
  return { isPremium: premium, isInTrial, hasAccess, locked: !hasAccess, trialDaysLeft };
}

/** Garde serveur : accès autorisé si le paywall est off (no-op) OU si l'user a
 * un accès actif (essai/premium). À utiliser dans les routes API coûteuses. */
export function serverHasAccess(state: SubscriptionState | undefined | null): boolean {
  if (!isPaywallEnabled()) return true;
  return computeAccess(state).hasAccess;
}
