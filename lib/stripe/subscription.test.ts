import { describe, it, expect, afterEach } from 'vitest';
import {
  computeAccess,
  serverHasAccess,
  isPaywallEnabled,
  isPremium,
  canAccessFeature,
  type SubscriptionState,
} from './subscription';

const DAY = 86_400_000;
const NOW = 1_800_000_000_000; // instant de référence fixe

function trial(endsOffsetDays: number): SubscriptionState {
  return { tier: 'free', trial_ends_at: new Date(NOW + endsOffsetDays * DAY).toISOString() };
}

describe('computeAccess', () => {
  it('locks a user with no subscription state', () => {
    const a = computeAccess(null, NOW);
    expect(a.hasAccess).toBe(false);
    expect(a.locked).toBe(true);
    expect(a.isInTrial).toBe(false);
    expect(a.isPremium).toBe(false);
    expect(a.trialDaysLeft).toBe(0);
  });

  it('grants access to a premium user (no trial needed)', () => {
    const a = computeAccess({ tier: 'premium' }, NOW);
    expect(a.isPremium).toBe(true);
    expect(a.hasAccess).toBe(true);
    expect(a.locked).toBe(false);
  });

  it('grants access during an active trial', () => {
    const a = computeAccess(trial(10), NOW); // se termine dans 10 j
    expect(a.isInTrial).toBe(true);
    expect(a.hasAccess).toBe(true);
    expect(a.locked).toBe(false);
    expect(a.trialDaysLeft).toBe(10);
  });

  it('locks a user whose trial has expired (and not premium)', () => {
    const a = computeAccess(trial(-1), NOW); // terminé hier
    expect(a.isInTrial).toBe(false);
    expect(a.hasAccess).toBe(false);
    expect(a.locked).toBe(true);
    expect(a.trialDaysLeft).toBe(0);
  });

  it('premium overrides an expired trial', () => {
    const a = computeAccess({ ...trial(-5), tier: 'premium' }, NOW);
    expect(a.hasAccess).toBe(true);
    expect(a.locked).toBe(false);
  });

  it('rounds trialDaysLeft up (partial last day counts)', () => {
    const a = computeAccess(
      { tier: 'free', trial_ends_at: new Date(NOW + DAY * 2.4).toISOString() },
      NOW,
    );
    expect(a.trialDaysLeft).toBe(3);
  });

  it('treats a malformed trial_ends_at as no trial', () => {
    const a = computeAccess({ tier: 'free', trial_ends_at: 'pas-une-date' }, NOW);
    expect(a.isInTrial).toBe(false);
    expect(a.locked).toBe(true);
  });
});

describe('serverHasAccess + isPaywallEnabled (env-driven)', () => {
  const prev = process.env.NEXT_PUBLIC_ENABLE_PAYWALL;
  afterEach(() => {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_ENABLE_PAYWALL;
    else process.env.NEXT_PUBLIC_ENABLE_PAYWALL = prev;
  });

  it('isPaywallEnabled reflects the env flag', () => {
    process.env.NEXT_PUBLIC_ENABLE_PAYWALL = '0';
    expect(isPaywallEnabled()).toBe(false);
    process.env.NEXT_PUBLIC_ENABLE_PAYWALL = '1';
    expect(isPaywallEnabled()).toBe(true);
  });

  it('grants access to everyone when paywall is OFF (no-op gating)', () => {
    process.env.NEXT_PUBLIC_ENABLE_PAYWALL = '0';
    expect(serverHasAccess(null)).toBe(true);
    expect(serverHasAccess({ tier: 'free' })).toBe(true);
  });

  it('enforces access when paywall is ON', () => {
    process.env.NEXT_PUBLIC_ENABLE_PAYWALL = '1';
    expect(serverHasAccess(null)).toBe(false); // locked
    expect(serverHasAccess({ tier: 'premium' })).toBe(true);
  });
});

// garde-fous sur les helpers existants (non régressés)
describe('legacy helpers intact', () => {
  it('isPremium', () => {
    expect(isPremium({ tier: 'premium' })).toBe(true);
    expect(isPremium({ tier: 'free' })).toBe(false);
    expect(isPremium(null)).toBe(false);
  });
  it('canAccessFeature', () => {
    expect(canAccessFeature({ tier: 'premium' }, 'premium')).toBe(true);
    expect(canAccessFeature({ tier: 'free' }, 'premium')).toBe(false);
    expect(canAccessFeature({ tier: 'free' }, 'free')).toBe(true);
  });
});
