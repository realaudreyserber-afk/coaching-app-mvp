/**
 * Firestore rules unit tests.
 * Requires Firebase Emulator: `firebase emulators:start --only firestore`
 * Run: npx vitest run test/rules
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

describe('Firestore rules — users/{uid}', () => {
  it('owner can read own user doc', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(alice.doc('users/alice').set({ profile: { name: 'A' } }));
    await assertSucceeds(alice.doc('users/alice').get());
  });

  it('owner can write any subcollection at any depth', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(alice.doc('users/alice/checkins_daily/2026-05-24').set({ weight: 80 }));
    await assertSucceeds(alice.doc('users/alice/plans/p1/exercises/e1/sets/s1').set({ reps: 10 }));
    await assertSucceeds(alice.doc('users/alice/coach_messages/m1').set({ role: 'user', content: 'hi' }));
  });

  it('non-owner cannot read another user doc', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(alice.doc('users/alice').set({ profile: { name: 'A' } }));

    const bob = env.authenticatedContext('bob').firestore();
    await assertFails(bob.doc('users/alice').get());
  });

  it('non-owner cannot write a subcollection of another user', async () => {
    const bob = env.authenticatedContext('bob').firestore();
    await assertFails(bob.doc('users/alice/checkins_daily/2026-05-24').set({ weight: 80 }));
  });

  it('unauthenticated cannot read users', async () => {
    const guest = env.unauthenticatedContext().firestore();
    await assertFails(guest.doc('users/alice').get());
  });
});

describe('Firestore rules — content/* (admin-only write)', () => {
  it('any authenticated user can read content', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('content/foods/items/1234').set({ name: 'Pomme', kcal_100g: 52 });
    });
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(alice.doc('content/foods/items/1234').get());
  });

  it('user cannot write to content/foods (NO MORE POISONING)', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(alice.doc('content/foods/items/9999').set({ name: 'Poison', kcal_100g: 0 }));
  });

  it('user cannot write to content/recipes', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(alice.doc('content/recipes/r1').set({ name: 'Burger frites' }));
  });

  it('unauthenticated cannot read content', async () => {
    const guest = env.unauthenticatedContext().firestore();
    await assertFails(guest.doc('content/foods/items/1234').get());
  });
});

describe('Firestore rules — experiments and exposures', () => {
  it('user can read experiment metadata', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('experiments/pricing_test').set({ variants: ['a', 'b'] });
    });
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(alice.doc('experiments/pricing_test').get());
  });

  it('user cannot write experiment metadata', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(alice.doc('experiments/hack').set({ variants: ['win'] }));
  });

  it('user can create exposure event tied to own uid', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(
      alice.doc('experiment_exposures/e1').set({
        uid: 'alice',
        experimentId: 'pricing_test',
        variant: 'a',
        timestamp: new Date().toISOString(),
      })
    );
  });

  it('user cannot create exposure event tied to another uid (anti-spoof)', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(
      alice.doc('experiment_exposures/e2').set({
        uid: 'bob',
        experimentId: 'pricing_test',
        variant: 'a',
      })
    );
  });

  it('user cannot read exposure events (admin BigQuery only)', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('experiment_exposures/e3').set({ uid: 'alice', variant: 'a' });
    });
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(alice.doc('experiment_exposures/e3').get());
  });

  it('user cannot update or delete own exposure (append-only)', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(
      alice.doc('experiment_exposures/e4').set({ uid: 'alice', experimentId: 'x', variant: 'a' })
    );
    await assertFails(alice.doc('experiment_exposures/e4').update({ variant: 'b' }));
    await assertFails(alice.doc('experiment_exposures/e4').delete());
  });
});
