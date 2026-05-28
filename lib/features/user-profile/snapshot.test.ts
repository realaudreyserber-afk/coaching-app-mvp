import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// snapshot.ts reads adminDb.collection('users').doc(uid).get(). We mock the
// firebase admin module to feed a fake Firestore document — no network/SDK.
const getMock = vi.fn();
vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: () => ({
      doc: () => ({ get: getMock }),
    }),
  },
}));

import { getUserProfileSnapshot } from './snapshot';

/** Stub the next doc.get() to resolve a doc that exists with `data`. */
function mockUserDoc(data: Record<string, unknown>) {
  getMock.mockResolvedValueOnce({ exists: true, data: () => data });
}

beforeEach(() => {
  getMock.mockReset();
  vi.useRealTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('snapshot — getUserProfileSnapshot', () => {
  it('throws when the user document does not exist', async () => {
    getMock.mockResolvedValueOnce({ exists: false, data: () => undefined });
    await expect(getUserProfileSnapshot('missing')).rejects.toThrow(/not found/);
  });

  it('weight_kg uses profile.weight first', async () => {
    mockUserDoc({ profile: { weight: 82 }, baseline: { weight: 90 } });
    const snap = await getUserProfileSnapshot('u1');
    expect(snap.weight_kg).toBe(82);
  });

  it('weight_kg falls back to baseline.weight when profile.weight is absent', async () => {
    mockUserDoc({ profile: {}, baseline: { weight: 90 } });
    const snap = await getUserProfileSnapshot('u1');
    expect(snap.weight_kg).toBe(90);
  });

  it('weight_kg is null when neither profile nor baseline has weight', async () => {
    mockUserDoc({ profile: {}, baseline: {} });
    const snap = await getUserProfileSnapshot('u1');
    expect(snap.weight_kg).toBeNull();
  });

  it('maps hormonal_context from profile first, then medical fallback', async () => {
    mockUserDoc({ profile: { hormonal_context: 'trt' }, medical: { hormonal_context: 'none' } });
    expect((await getUserProfileSnapshot('u1')).hormonal_context).toBe('trt');

    mockUserDoc({ profile: {}, medical: { hormonal_context: 'trt' } });
    expect((await getUserProfileSnapshot('u1')).hormonal_context).toBe('trt');

    mockUserDoc({ profile: {}, medical: {} });
    expect((await getUserProfileSnapshot('u1')).hormonal_context).toBeNull();
  });

  it('allergies fall back to medical.allergies when profile has none', async () => {
    mockUserDoc({ profile: {}, medical: { allergies: ['arachides', 'lactose'] } });
    const snap = await getUserProfileSnapshot('u1');
    expect(snap.allergies).toEqual(['arachides', 'lactose']);
  });

  it('allergies prefer profile.allergies over medical.allergies', async () => {
    mockUserDoc({
      profile: { allergies: ['gluten'] },
      medical: { allergies: ['arachides'] },
    });
    expect((await getUserProfileSnapshot('u1')).allergies).toEqual(['gluten']);
  });

  it('computes age from dob (birthday already passed this year)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));
    mockUserDoc({ profile: { dob: '1990-01-10' } });
    const snap = await getUserProfileSnapshot('u1');
    expect(snap.age).toBe(36);
  });

  it('computes age from dob (birthday not yet reached this year)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));
    mockUserDoc({ profile: { dob: '1990-12-31' } });
    const snap = await getUserProfileSnapshot('u1');
    expect(snap.age).toBe(35);
  });

  it('uses profile.age when no dob is present', async () => {
    mockUserDoc({ profile: { age: 42 } });
    expect((await getUserProfileSnapshot('u1')).age).toBe(42);
  });

  it('age is null when neither dob nor numeric age is present', async () => {
    mockUserDoc({ profile: {} });
    expect((await getUserProfileSnapshot('u1')).age).toBeNull();
  });

  it('uses_glp1 falls back to medical.glp1.active', async () => {
    mockUserDoc({ profile: {}, medical: { glp1: { active: true } } });
    expect((await getUserProfileSnapshot('u1')).uses_glp1).toBe(true);

    mockUserDoc({ profile: {}, medical: {} });
    expect((await getUserProfileSnapshot('u1')).uses_glp1).toBe(false);
  });

  it('maps goals + objective from the goals map', async () => {
    mockUserDoc({
      profile: {},
      goals: { type: 'lose_weight', target_weight: 70, target_date: '2026-12-01' },
    });
    const snap = await getUserProfileSnapshot('u1');
    expect(snap.objective).toBe('lose_weight');
    expect(snap.target_weight_kg).toBe(70);
    expect(snap.goals?.type).toBe('lose_weight');
    expect(snap.goals?.target_date).toBe('2026-12-01');
  });

  it('returns sane defaults for an essentially empty profile', async () => {
    mockUserDoc({});
    const snap = await getUserProfileSnapshot('u-empty');
    expect(snap.uid).toBe('u-empty');
    expect(snap.name).toBe('');
    expect(snap.age).toBeNull();
    expect(snap.weight_kg).toBeNull();
    expect(snap.uses_glp1).toBe(false);
    expect(snap.ed_history).toBe(false);
  });

  it('ed_history falls back to legacy tca_history flag', async () => {
    mockUserDoc({ profile: { tca_history: true } });
    expect((await getUserProfileSnapshot('u1')).ed_history).toBe(true);
  });
});
