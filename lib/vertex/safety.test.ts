import { describe, it, expect } from 'vitest';
import { runSafetyCheck, checkUserBaseline } from './safety';

describe('Safety layer — fast path detection', () => {
  it('flags SUICIDE on suicidal ideation keywords', async () => {
    const out = await runSafetyCheck("J'ai plus envie de vivre, je veux en finir.");
    expect(out.flagged).toBe(true);
    expect(out.reason).toBe('SUICIDE');
    expect(out.message).toContain('3114');
  });

  it('flags TCA on compensatory behavior keywords', async () => {
    const out = await runSafetyCheck("J'ai trop mangé hier, je vais me faire vomir.");
    expect(out.flagged).toBe(true);
    expect(out.reason).toBe('TCA');
    expect(out.message).toContain('FFAB');
  });

  it('flags UNDERWEIGHT when BMI < 18.5', async () => {
    const out = await checkUserBaseline({ weightKg: 45, heightCm: 170 });
    expect(out.flagged).toBe(true);
    expect(out.reason).toBe('UNDERWEIGHT');
    expect(out.message).toContain('18.5');
  });

  it('does not flag healthy BMI baseline', async () => {
    const out = await checkUserBaseline({ weightKg: 75, heightCm: 175 });
    expect(out.flagged).toBe(false);
    expect(out.reason).toBe(null);
  });

  it('does not flag neutral coach message', async () => {
    const out = await runSafetyCheck(
      'Combien de protéines par kilo en sèche ?',
      { weightKg: 80, heightCm: 180 }
    );
    expect(out.flagged).toBe(false);
  });

  it('handles missing baseline gracefully', async () => {
    const out = await runSafetyCheck('Question banale');
    expect(out.flagged).toBe(false);
  });

  it('handles zero-height edge case without dividing', async () => {
    const out = await checkUserBaseline({ weightKg: 70, heightCm: 0 });
    expect(out.flagged).toBe(false);
  });
});
