import { describe, it, expect } from 'vitest';
import {
  aggregateMicronutrients,
  coveragePct,
  detectDeficits,
  RDI,
  type DailyMicroIntake,
} from './aggregator';
import { newFoodLog } from '../food-logs/schema';

describe('aggregateMicronutrients', () => {
  it('sums fiber + sodium across items, scaled by qty', () => {
    const log = newFoodLog({
      date: '2026-05-24',
      source: 'barcode',
      items: [
        { name: 'Pomme', qty_g: 200, kcal: 104, p: 0.5, c: 28, f: 0.3, fiber_g: 2.4, sodium_mg: 1 },
        { name: 'Poulet', qty_g: 100, kcal: 165, p: 31, c: 0, f: 3.6, fiber_g: 0, sodium_mg: 70 },
      ],
    });
    const out = aggregateMicronutrients('2026-05-24', [log]);
    // Pomme: fiber 2.4 * 200/100 = 4.8, sodium 1 * 200/100 = 2
    // Poulet: fiber 0, sodium 70 * 100/100 = 70
    expect(out.fiber_g).toBeCloseTo(4.8);
    expect(out.sodium_mg).toBeCloseTo(72);
  });

  it('returns blank intake when no logs', () => {
    const out = aggregateMicronutrients('2026-05-24', []);
    expect(out.fiber_g).toBe(0);
    expect(out.vit_c_mg).toBe(0);
  });

  it('ignores undefined micronutrient fields gracefully', () => {
    const log = newFoodLog({
      date: '2026-05-24',
      source: 'manual',
      items: [{ name: 'X', qty_g: 100, kcal: 100, p: 10, c: 10, f: 5 }],
    });
    const out = aggregateMicronutrients('2026-05-24', [log]);
    expect(out.fiber_g).toBe(0);
    expect(out.sodium_mg).toBe(0);
  });
});

describe('coveragePct', () => {
  it('100% if intake equals RDI', () => {
    const intake: DailyMicroIntake = { date: '2026-05-24', ...RDI };
    const c = coveragePct(intake);
    expect(c.fiber_g).toBe(100);
    expect(c.iron_mg).toBe(100);
  });

  it('50% if intake is half RDI', () => {
    const intake: DailyMicroIntake = {
      date: '2026-05-24',
      ...(Object.fromEntries(
        Object.entries(RDI).map(([k, v]) => [k, v / 2])
      ) as Omit<DailyMicroIntake, 'date'>),
    };
    expect(coveragePct(intake).vit_c_mg).toBe(50);
  });
});

describe('detectDeficits', () => {
  it('flags nutrient < 70% AJR over 7+ days', () => {
    const history: DailyMicroIntake[] = Array.from({ length: 14 }, () => ({
      date: '2026-05-24',
      ...RDI,
      iron_mg: 5, // 5 / 11 = 45% → deficit
    }));
    const out = detectDeficits(history);
    const iron = out.find((d) => d.nutrient === 'iron_mg');
    expect(iron).toBeDefined();
    expect(iron?.avg_coverage_pct).toBeCloseTo(45.5, 1);
  });

  it('does not flag zero coverage (insufficient data, not deficit)', () => {
    const history: DailyMicroIntake[] = Array.from({ length: 14 }, (_, i) => ({
      date: `2026-05-${String(i + 1).padStart(2, '0')}`,
      ...RDI,
      vit_d_mcg: 0,
    }));
    const out = detectDeficits(history);
    expect(out.find((d) => d.nutrient === 'vit_d_mcg')).toBeUndefined();
  });

  it('returns empty array for short history', () => {
    expect(detectDeficits([])).toEqual([]);
    const short: DailyMicroIntake[] = Array.from({ length: 3 }, () => ({ date: 'x', ...RDI }));
    expect(detectDeficits(short)).toEqual([]);
  });
});
