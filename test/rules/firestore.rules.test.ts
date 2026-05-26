/**
 * Firestore rules unit tests.
 *
 * Requires Firebase Emulator running on 127.0.0.1:8080.
 * Start with: `firebase emulators:start --only firestore`
 * Then:       `npx vitest run --config vitest.rules.config.ts`
 *
 * Updated post-Pile2 #8 hardening — covers the Wave 5/6 new collections
 * (coach_state, coach_patches, plans_history, workout_sessions,
 * session_debriefs, ai_cache, wearable_sync, body_scans, form_checks).
 *
 * Convention used in the rules :
 *   - Owner client CAN read+write : profile, checkins_*, food_logs,
 *     coach_messages (user messages), daily_tasks, medications,
 *     micronutrients_daily, referrals, streaks, alerts.
 *   - Owner client CAN read but NOT write (server-only via admin SDK) :
 *     coach_state, coach_patches, plans, plans_history, workout_sessions,
 *     session_debriefs, ai_cache, insights_daily, tdee_history,
 *     notification_log, form_checks, body_scans, bloodwork, wearable_sync.
 *   - Owner CAN NOT read at all : tokens (OAuth secrets), rate_limits.
 */
import { describe, it, beforeAll, afterAll, beforeEach, expect } from 'vitest';
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let env: RulesTestEnvironment;

const PROJECT_ID = 'linsociable-coaching-test';

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(resolve(__dirname, '../../firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

// ════════════════════════════════════════════════════════════════════
// users/{uid} — root doc + client-writable sub-collections
// ════════════════════════════════════════════════════════════════════

describe('Firestore rules — users/{uid} root', () => {
  it('owner reads + writes own user doc', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(alice.doc('users/alice').set({ profile: { name: 'A' } }));
    await assertSucceeds(alice.doc('users/alice').get());
  });

  it('non-owner cannot read another user doc', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(alice.doc('users/alice').set({ profile: { name: 'A' } }));
    const bob = env.authenticatedContext('bob').firestore();
    await assertFails(bob.doc('users/alice').get());
  });

  it('unauthenticated cannot read users', async () => {
    const guest = env.unauthenticatedContext().firestore();
    await assertFails(guest.doc('users/alice').get());
  });
});

describe('Firestore rules — client-writable sub-collections', () => {
  it('owner writes checkins_daily + food_logs + coach_messages + daily_tasks', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(alice.doc('users/alice/checkins_daily/2026-05-24').set({ weight: 80 }));
    // Wave 13C — Shape validation on food_logs: require date + kcal.
    await assertSucceeds(
      alice
        .doc('users/alice/food_logs/log1')
        .set({ date: '2026-05-24', kcal: 500, logged_at: '2026-05-24T12:00:00Z' }),
    );
    // Wave 13C — Shape validation on coach_messages: role MUST be 'user'
    // on client direct writes (assistant writes go through admin SDK).
    await assertSucceeds(alice.doc('users/alice/coach_messages/m1').set({ role: 'user', content: 'hi' }));
    await assertSucceeds(alice.doc('users/alice/daily_tasks/2026-05-24').set({ completed: true }));
  });

  it('owner cannot impersonate the assistant nor write malformed food_logs', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    // Coach impersonation — must be blocked by the new rule.
    await assertFails(
      alice.doc('users/alice/coach_messages/fake').set({ role: 'assistant', content: 'fake coach' }),
    );
    // Missing required fields on food_logs.
    await assertFails(alice.doc('users/alice/food_logs/bad1').set({ logged_at: '...' }));
    // kcal out of bounds.
    await assertFails(alice.doc('users/alice/food_logs/bad2').set({ date: '2026-05-24', kcal: 99999 }));
  });

  it('non-owner cannot write any client-writable sub-collection', async () => {
    const bob = env.authenticatedContext('bob').firestore();
    await assertFails(bob.doc('users/alice/checkins_daily/2026-05-24').set({ weight: 80 }));
    await assertFails(bob.doc('users/alice/food_logs/log1').set({ date: '2026-05-24', kcal: 500 }));
    await assertFails(bob.doc('users/alice/coach_messages/m1').set({ role: 'user', content: 'spy' }));
  });
});

// ════════════════════════════════════════════════════════════════════
// Server-only sub-collections (read-own, no client write)
// ════════════════════════════════════════════════════════════════════

describe('Firestore rules — server-only collections (Wave 5/6)', () => {
  it('owner CAN read coach_state but CANNOT write (server-only via admin SDK)', async () => {
    // Pre-populate via admin bypass
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('users/alice/coach_state/main').set({ welcome_sent: true });
    });
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(alice.doc('users/alice/coach_state/main').get());
    await assertFails(alice.doc('users/alice/coach_state/main').set({ hacked: true }));
  });

  it('owner CAN read coach_patches but CANNOT write (audit log immutable for client)', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('users/alice/coach_patches/p1').set({ applied_at: '2026-05-24' });
    });
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(alice.doc('users/alice/coach_patches/p1').get());
    await assertFails(alice.doc('users/alice/coach_patches/p2').set({ fake: true }));
  });

  it('owner CAN read plans but CANNOT modify (must go via /api/coach/apply-patch)', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('users/alice/plans/p1').set({ kcal: 2000, active: true });
    });
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(alice.doc('users/alice/plans/p1').get());
    await assertFails(alice.doc('users/alice/plans/p1').update({ kcal: 1500 }));
  });

  it('owner CAN read plans_history (archive) but CANNOT write', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('users/alice/plans_history/h1').set({ archived_at: '2026-05-24' });
    });
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(alice.doc('users/alice/plans_history/h1').get());
    await assertFails(alice.doc('users/alice/plans_history/h2').set({ fake: true }));
  });

  it('owner CAN read workout_sessions but CANNOT write (must go via /api/sessions/*)', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('users/alice/workout_sessions/s1').set({ status: 'completed' });
    });
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(alice.doc('users/alice/workout_sessions/s1').get());
    await assertFails(alice.doc('users/alice/workout_sessions/s1').update({ status: 'in_progress' }));
  });

  it('owner CAN read session_debriefs cache but CANNOT write', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('users/alice/session_debriefs/d1').set({ text: 'good job' });
    });
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(alice.doc('users/alice/session_debriefs/d1').get());
    await assertFails(alice.doc('users/alice/session_debriefs/d2').set({ fake: true }));
  });

  it('owner CAN read ai_cache but CANNOT write', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('users/alice/ai_cache/progress_analysis').set({ text: '...' });
    });
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(alice.doc('users/alice/ai_cache/progress_analysis').get());
    await assertFails(alice.doc('users/alice/ai_cache/forge').set({ hack: true }));
  });

  it('owner CAN read body_scans + form_checks + bloodwork but CANNOT write', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('users/alice/body_scans/2026-05-24').set({ bf_pct_estimated: 18 });
      await ctx.firestore().doc('users/alice/form_checks/fc1').set({ exercise: 'squat' });
      await ctx.firestore().doc('users/alice/bloodwork/bw1').set({ date: '2026-05-24' });
    });
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(alice.doc('users/alice/body_scans/2026-05-24').get());
    await assertSucceeds(alice.doc('users/alice/form_checks/fc1').get());
    await assertSucceeds(alice.doc('users/alice/bloodwork/bw1').get());
    await assertFails(alice.doc('users/alice/body_scans/2026-05-24').update({ bf_pct_estimated: 5 }));
    await assertFails(alice.doc('users/alice/form_checks/fc2').set({ exercise: 'fake' }));
  });

  it('owner CAN read wearable_sync but CANNOT write', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('users/alice/wearable_sync/2026-05-24').set({ steps: 8500 });
    });
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(alice.doc('users/alice/wearable_sync/2026-05-24').get());
    await assertFails(alice.doc('users/alice/wearable_sync/2026-05-24').update({ steps: 999999 }));
  });

  it('non-owner cannot read any server-only collection', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('users/alice/coach_state/main').set({ welcome_sent: true });
      await ctx.firestore().doc('users/alice/plans/p1').set({ kcal: 2000 });
    });
    const bob = env.authenticatedContext('bob').firestore();
    await assertFails(bob.doc('users/alice/coach_state/main').get());
    await assertFails(bob.doc('users/alice/plans/p1').get());
  });
});

// ════════════════════════════════════════════════════════════════════
// Highly-sensitive collections — owner CAN'T even read
// ════════════════════════════════════════════════════════════════════

describe('Firestore rules — top-secret collections', () => {
  it('owner CANNOT read own OAuth tokens (admin SDK only)', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('users/alice/tokens/google-fit').set({ access_token: 'secret' });
    });
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(alice.doc('users/alice/tokens/google-fit').get());
  });

  it('owner CANNOT read own rate_limits doc', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('users/alice/rate_limits/ai_coach').set({ minute_count: 5 });
    });
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(alice.doc('users/alice/rate_limits/ai_coach').get());
  });
});

// ════════════════════════════════════════════════════════════════════
// content/** — public read, admin write
// ════════════════════════════════════════════════════════════════════

describe('Firestore rules — content/* (admin-only write)', () => {
  it('any authenticated user can read content', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('content/foods/items/1234').set({ name: 'Pomme', kcal_100g: 52 });
    });
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(alice.doc('content/foods/items/1234').get());
  });

  it('user cannot write to content/foods', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(alice.doc('content/foods/items/9999').set({ name: 'Poison', kcal_100g: 0 }));
  });

  it('user cannot write to legacy flat recipes / foods / exercises', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(alice.doc('recipes/r1').set({ name: 'Burger frites' }));
    await assertFails(alice.doc('foods/f1').set({ name: 'Junk' }));
    await assertFails(alice.doc('exercises/e1').set({ name: 'Faked' }));
  });

  it('unauthenticated cannot read content', async () => {
    const guest = env.unauthenticatedContext().firestore();
    await assertFails(guest.doc('content/foods/items/1234').get());
  });
});

// ════════════════════════════════════════════════════════════════════
// A/B testing exposures — uid-prefixed doc id required
// ════════════════════════════════════════════════════════════════════

describe('Firestore rules — experiment_exposures', () => {
  it('user can create exposure with own uid field (auto-id allowed)', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(
      alice.doc('experiment_exposures/anyAutoId').set({
        uid: 'alice',
        experimentId: 'pricing_test',
        variant: 'a',
        timestamp: new Date().toISOString(),
      }),
    );
  });

  it('user cannot spoof another uid in exposure data', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(
      alice.doc('experiment_exposures/anyOtherId').set({
        uid: 'bob',
        experimentId: 'pricing_test',
        variant: 'a',
      }),
    );
  });

  it('user cannot update or delete own exposure (append-only)', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(
      alice.doc('experiment_exposures/x1').set({ uid: 'alice', experimentId: 'x', variant: 'a' }),
    );
    await assertFails(alice.doc('experiment_exposures/x1').update({ variant: 'b' }));
    await assertFails(alice.doc('experiment_exposures/x1').delete());
  });

  it('user can read+write own users/{uid}/experiments/{experimentId} doc', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(
      alice.doc('users/alice/experiments/pricing_test').set({
        variant: 'a',
        assigned_at: new Date().toISOString(),
      }),
    );
    await assertSucceeds(alice.doc('users/alice/experiments/pricing_test').get());
  });

  it('non-owner cannot read another user experiments doc', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('users/alice/experiments/pricing_test').set({ variant: 'a' });
    });
    const bob = env.authenticatedContext('bob').firestore();
    await assertFails(bob.doc('users/alice/experiments/pricing_test').get());
  });
});

// ════════════════════════════════════════════════════════════════════
// Top-level server-only / admin collections
// ════════════════════════════════════════════════════════════════════

describe('Firestore rules — admin-only top-level', () => {
  it('user cannot read _stripe_events', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('_stripe_events/e1').set({ type: 'paid' });
    });
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(alice.doc('_stripe_events/e1').get());
  });

  it('user cannot read rgpd_audit_log', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('rgpd_audit_log/log1').set({ uid: 'alice', action: 'export' });
    });
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(alice.doc('rgpd_audit_log/log1').get());
  });

  it('user cannot write to admin/*', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(alice.doc('admin/dashboard/metrics/m1').set({ value: 42 }));
  });
});

// ════════════════════════════════════════════════════════════════════
// Default-deny catchall
// ════════════════════════════════════════════════════════════════════

describe('Firestore rules — default deny', () => {
  it('any unmatched collection denies both read and write', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(alice.doc('random_collection/x').set({ foo: 'bar' }));
    await assertFails(alice.doc('random_collection/x').get());
  });
});
