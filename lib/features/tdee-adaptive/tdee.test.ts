import { describe, it, expect } from 'vitest';
import { calculateWeightSlope, computeTDEE } from './index';

describe('Adaptive TDEE Linear Regression & Calculations', () => {
  describe('calculateWeightSlope', () => {
    it('should return 0 when there are less than 2 points', () => {
      expect(calculateWeightSlope([])).toBe(0);
      expect(calculateWeightSlope([{ dayIndex: 0, weight: 80 }])).toBe(0);
    });

    it('should calculate correct positive slope', () => {
      const points = [
        { dayIndex: 0, weight: 80.0 },
        { dayIndex: 1, weight: 80.1 },
        { dayIndex: 2, weight: 80.2 },
        { dayIndex: 3, weight: 80.3 },
      ];
      const slope = calculateWeightSlope(points);
      expect(slope).toBeCloseTo(0.1, 5);
    });

    it('should calculate correct negative slope', () => {
      const points = [
        { dayIndex: 0, weight: 80.0 },
        { dayIndex: 1, weight: 79.9 },
        { dayIndex: 2, weight: 79.8 },
        { dayIndex: 3, weight: 79.7 },
      ];
      const slope = calculateWeightSlope(points);
      expect(slope).toBeCloseTo(-0.1, 5);
    });
  });

  describe('computeTDEE', () => {
    it('should return fallback TDEE if points count is less than 5', () => {
      const points = [
        { dayIndex: 0, weight: 80, calories: 2000 },
        { dayIndex: 1, weight: 80, calories: 2000 },
      ];
      const result = computeTDEE(points, 2500);
      expect(result.tdee).toBe(2500);
    });

    it('should calculate TDEE equal to intake if weight is stable (slope = 0)', () => {
      const points = [
        { dayIndex: 0, weight: 80, calories: 2000 },
        { dayIndex: 1, weight: 80, calories: 2000 },
        { dayIndex: 2, weight: 80, calories: 2000 },
        { dayIndex: 3, weight: 80, calories: 2000 },
        { dayIndex: 4, weight: 80, calories: 2000 },
        { dayIndex: 5, weight: 80, calories: 2000 },
      ];
      const result = computeTDEE(points, 2500);
      expect(result.tdee).toBe(2000);
      expect(result.weightChangePerDay).toBe(0);
    });

    it('should estimate higher TDEE if weight is decreasing (weight loss = calories deficit)', () => {
      // 14 days weight loss of 1kg -> slope = -1/14 kg/day
      // energy deficit = -1/14 * 7700 = -550 kcal/day
      // TDEE = intake - deficit = 2000 - (-550) = 2550
      const points = Array.from({ length: 14 }, (_, i) => ({
        dayIndex: i,
        weight: 80.0 - i * (1.0 / 13), // loses 1kg total from day 0 to day 13
        calories: 2000,
      }));

      const result = computeTDEE(points, 2000);
      expect(result.tdee).toBeGreaterThan(2000);
      expect(result.weightChangePerDay).toBeLessThan(0);
    });

    it('should estimate lower TDEE if weight is increasing (weight gain = calories surplus)', () => {
      const points = Array.from({ length: 14 }, (_, i) => ({
        dayIndex: i,
        weight: 80.0 + i * (1.0 / 13), // gains 1kg total
        calories: 2000,
      }));

      const result = computeTDEE(points, 2000);
      expect(result.tdee).toBeLessThan(2000);
      expect(result.weightChangePerDay).toBeGreaterThan(0);
    });
  });
});
