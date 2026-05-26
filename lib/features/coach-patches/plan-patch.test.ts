import { describe, expect, it } from 'vitest';
import {
  validatePatchEntry,
  validatePatch,
  applyPatchToPlan,
  parsePatchPayload,
} from './plan-patch';

describe('validatePatchEntry — whitelist', () => {
  it('accepts kcal in range', () => {
    expect(validatePatchEntry('kcal', 2200)).toBeNull();
  });
  it('rejects kcal below min', () => {
    expect(validatePatchEntry('kcal', 600)).toMatch(/below_min/);
  });
  it('rejects kcal above max', () => {
    expect(validatePatchEntry('kcal', 7000)).toMatch(/above_max/);
  });
  it('accepts macros.p', () => {
    expect(validatePatchEntry('macros.p', 180)).toBeNull();
  });
  it('rejects unwhitelisted path', () => {
    expect(validatePatchEntry('subscription.tier', 'premium')).toBe('path_not_whitelisted');
    expect(validatePatchEntry('profile.weight', 80)).toBe('path_not_whitelisted');
  });
  it('accepts training session frequency', () => {
    expect(validatePatchEntry('training.sessions.0.frequency_weekly', 3)).toBeNull();
  });
  it('rejects training session index > 20', () => {
    expect(validatePatchEntry('training.sessions.21.frequency_weekly', 3)).toBe('path_not_whitelisted');
  });
  it('accepts cardio intensity enum', () => {
    expect(validatePatchEntry('cardio.intensity', 'modérée')).toBeNull();
    expect(validatePatchEntry('cardio.intensity', 'extreme')).toBe('not_in_enum');
  });
  it('caps meals_template description length', () => {
    expect(validatePatchEntry('meals_template.0.description', 'a'.repeat(700))).toMatch(/too_long/);
    expect(validatePatchEntry('meals_template.0.description', 'a'.repeat(500))).toBeNull();
  });
  it('accepts null to clear', () => {
    expect(validatePatchEntry('kcal', null)).toBeNull();
  });
});

describe('validatePatch — split accepted/rejected', () => {
  it('splits correctly', () => {
    const r = validatePatch([
      { path: 'kcal', value: 2200 },
      { path: 'macros.p', value: 200 },
      { path: 'subscription.tier', value: 'premium' },
      { path: 'kcal', value: 100 }, // below min
    ]);
    expect(r.accepted).toHaveLength(2);
    expect(r.rejected).toHaveLength(2);
    expect(r.rejected[0].reason).toBe('path_not_whitelisted');
    expect(r.rejected[1].reason).toMatch(/below_min/);
  });
});

describe('applyPatchToPlan', () => {
  it('applies a flat top-level field', () => {
    const plan = { kcal: 2000, macros: { p: 150, c: 200, f: 60 } };
    const out = applyPatchToPlan(plan, [{ path: 'kcal', value: 2400 }]);
    expect(out.kcal).toBe(2400);
    expect(plan.kcal).toBe(2000); // input not mutated
  });
  it('applies nested macro patch', () => {
    const plan = { kcal: 2000, macros: { p: 150, c: 200, f: 60 } };
    const out = applyPatchToPlan(plan, [{ path: 'macros.p', value: 200 }]);
    expect(out.macros.p).toBe(200);
    expect(out.macros.c).toBe(200);
  });
  it('applies array element field', () => {
    const plan = {
      training: {
        sessions: [
          { name: 'Push', frequency_weekly: 2, exercises: [{ name: 'DC', sets: 3, reps: '8-12', rest_seconds: 120 }] },
          { name: 'Pull', frequency_weekly: 2, exercises: [] },
        ],
      },
    };
    const out = applyPatchToPlan(plan, [
      { path: 'training.sessions.0.frequency_weekly', value: 3 },
      { path: 'training.sessions.0.exercises.0.rest_seconds', value: 180 },
    ]);
    expect(out.training.sessions[0].frequency_weekly).toBe(3);
    expect(out.training.sessions[0].exercises[0].rest_seconds).toBe(180);
    expect(out.training.sessions[1].frequency_weekly).toBe(2);
  });
  it('skips patch when array index out of bounds', () => {
    const plan = { training: { sessions: [{ name: 'A' }] } };
    const out = applyPatchToPlan(plan, [{ path: 'training.sessions.5.frequency_weekly', value: 3 }]);
    expect(out).toEqual(plan);
  });
});

describe('parsePatchPayload', () => {
  it('parses flat object', () => {
    const entries = parsePatchPayload({ kcal: 2200, 'macros.p': 180 });
    expect(entries).toEqual([
      { path: 'kcal', value: 2200 },
      { path: 'macros.p', value: 180 },
    ]);
  });
  it('parses array form', () => {
    const entries = parsePatchPayload([
      { path: 'kcal', value: 2200 },
      { path: 'macros.p', value: 180 },
    ]);
    expect(entries).toEqual([
      { path: 'kcal', value: 2200 },
      { path: 'macros.p', value: 180 },
    ]);
  });
  it('throws on invalid payload', () => {
    expect(() => parsePatchPayload(42)).toThrow();
    expect(() => parsePatchPayload('foo')).toThrow();
  });
});
