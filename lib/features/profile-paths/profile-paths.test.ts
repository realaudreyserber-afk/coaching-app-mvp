import { describe, it, expect } from 'vitest';
import { detectProfilePath } from './detector';

describe('Profile Path Detector', () => {
  it('should detect standard path by default', () => {
    const context = {
      profile: { height: 175, weight: 70, sex: 'male' as const, activity_level: 'lightly_active' },
      baseline: { weight: 70, body_fat: 15 },
      medical: { medications: [], conditions: [] },
    };

    const path = detectProfilePath(context);
    expect(path).toBe('standard');
  });

  it('should detect glp1 path based on medications', () => {
    const context = {
      profile: { height: 175, weight: 85, sex: 'male' as const, activity_level: 'lightly_active' },
      baseline: { weight: 85, body_fat: 22 },
      medical: { medications: ['Ozempic 0.5mg', 'Metformine'], conditions: [] },
    };

    const path = detectProfilePath(context);
    expect(path).toBe('glp1');
  });

  it('should detect glp1 path based on active glp1 flag', () => {
    const context = {
      profile: { height: 175, weight: 85, sex: 'male' as const, activity_level: 'lightly_active' },
      baseline: { weight: 85 },
      medical: { medications: [], conditions: [] },
      glp1Active: true,
    };

    const path = detectProfilePath(context);
    expect(path).toBe('glp1');
  });

  it('should detect post-bariatric path based on conditions', () => {
    const context = {
      profile: { height: 160, weight: 75, sex: 'female' as const, activity_level: 'sedentary' },
      baseline: { weight: 75 },
      medical: { medications: [], conditions: ['sleeve gastrectomie en 2024', 'anémie'] },
    };

    const path = detectProfilePath(context);
    expect(path).toBe('post-bariatric');
  });

  it('should detect high-bf path based on high BMI', () => {
    const context = {
      profile: { height: 170, weight: 95, sex: 'female' as const, activity_level: 'sedentary' },
      baseline: { weight: 95 },
      medical: { medications: [], conditions: [] },
    };

    // BMI = 95 / (1.7^2) = 95 / 2.89 = 32.87 (Obese >= 30)
    const path = detectProfilePath(context);
    expect(path).toBe('high-bf');
  });

  it('should detect ex-athlete path based on very active level', () => {
    const context = {
      profile: { height: 180, weight: 82, sex: 'male' as const, activity_level: 'very_active' },
      baseline: { weight: 82 },
      medical: { medications: [], conditions: [] },
    };

    const path = detectProfilePath(context);
    expect(path).toBe('ex-athlete');
  });
});
