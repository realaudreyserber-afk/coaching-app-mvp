import { describe, it, expect } from 'vitest';
import { linearRegressionSlope, estimateAdaptiveTdee } from './regression';

describe('linearRegressionSlope', () => {
  it('returns 0 for fewer than 2 points', () => {
    expect(linearRegressionSlope([], [])).toBe(0);
    expect(linearRegressionSlope([1], [1])).toBe(0);
  });

  it('computes positive slope for ascending data', () => {
    const xs = [0, 1, 2, 3, 4];
    const ys = [10, 12, 14, 16, 18];
    expect(linearRegressionSlope(xs, ys)).toBeCloseTo(2);
  });

  it('computes negative slope for descending data', () => {
    const xs = [0, 1, 2, 3, 4];
    const ys = [100, 99, 98, 97, 96];
    expect(linearRegressionSlope(xs, ys)).toBeCloseTo(-1);
  });

  it('returns 0 when xs are constant', () => {
    expect(linearRegressionSlope([3, 3, 3], [1, 2, 3])).toBe(0);
  });

  it('handles mismatched arrays without throwing', () => {
    expect(linearRegressionSlope([1, 2, 3], [1, 2])).toBe(0);
  });
});

describe('estimateAdaptiveTdee', () => {
  it('returns null below 10 datapoints', () => {
    expect(estimateAdaptiveTdee([80, 80, 80], [2000, 2000, 2000])).toBeNull();
  });

  it('returns mean kcal when weight is stable', () => {
    const weights = Array(14).fill(80);
    const kcal = Array(14).fill(2200);
    expect(estimateAdaptiveTdee(weights, kcal)).toBe(2200);
  });

  it('returns higher TDEE when user is losing weight at constant intake', () => {
    const weights = Array.from({ length: 14 }, (_, i) => 90 - i * 0.1);
    const kcal = Array(14).fill(2000);
    const tdee = estimateAdaptiveTdee(weights, kcal);
    expect(tdee).not.toBeNull();
    expect(tdee!).toBeGreaterThan(2000);
  });

  it('returns lower TDEE when user is gaining at constant intake', () => {
    const weights = Array.from({ length: 14 }, (_, i) => 80 + i * 0.1);
    const kcal = Array(14).fill(3000);
    const tdee = estimateAdaptiveTdee(weights, kcal);
    expect(tdee).not.toBeNull();
    expect(tdee!).toBeLessThan(3000);
  });

  it('rejects implausible TDEE outside [1200, 5000]', () => {
    const weights = Array.from({ length: 14 }, (_, i) => 100 - i * 2);
    const kcal = Array(14).fill(500);
    expect(estimateAdaptiveTdee(weights, kcal)).toBeNull();
  });
});
