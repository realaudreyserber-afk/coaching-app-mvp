import { describe, it, expect } from 'vitest';
import { newFoodLog, computeTotals, FoodLogSchema } from './schema';

describe('food-logs canonical schema', () => {
  it('computeTotals aggregates kcal and macros across items', () => {
    const totals = computeTotals([
      { name: 'Pomme', qty_g: 150, kcal: 78, p: 0.4, c: 21, f: 0.3 },
      { name: 'Poulet', qty_g: 100, kcal: 165, p: 31, c: 0, f: 3.6 },
    ]);
    expect(totals.kcal).toBe(243);
    expect(totals.p).toBeCloseTo(31.4);
    expect(totals.c).toBe(21);
    expect(totals.f).toBeCloseTo(3.9);
  });

  it('newFoodLog auto-fills totals and timestamp', () => {
    const log = newFoodLog({
      date: '2026-05-24',
      meal_slot: 'lunch',
      source: 'photo_meal',
      items: [{ name: 'Pâtes', qty_g: 200, kcal: 280, p: 10, c: 56, f: 1.5 }],
    });
    expect(log.totals.kcal).toBe(280);
    expect(log.logged_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('rejects invalid date format', () => {
    expect(() =>
      FoodLogSchema.parse({
        date: '24-05-2026',
        source: 'manual',
        items: [{ name: 'X', qty_g: 1, kcal: 1, p: 0, c: 0, f: 0 }],
        totals: { kcal: 1, p: 0, c: 0, f: 0 },
        logged_at: new Date().toISOString(),
      })
    ).toThrow();
  });

  it('rejects empty items array', () => {
    expect(() =>
      newFoodLog({ date: '2026-05-24', source: 'manual', items: [] })
    ).toThrow();
  });

  it('source enum covers all V1 modules (M1, M2, M3, M14)', () => {
    const sources: Array<'photo_meal' | 'barcode' | 'voice' | 'recipe' | 'manual' | 'recipe_ocr'> = [
      'photo_meal',
      'barcode',
      'voice',
      'recipe',
      'manual',
      'recipe_ocr',
    ];
    for (const source of sources) {
      const log = newFoodLog({
        date: '2026-05-24',
        source,
        items: [{ name: 'Test', qty_g: 1, kcal: 1, p: 0, c: 0, f: 0 }],
      });
      expect(log.source).toBe(source);
    }
  });
});
