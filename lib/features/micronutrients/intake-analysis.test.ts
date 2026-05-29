import { describe, it, expect, vi } from 'vitest';

// food-composition (transitif) a 'server-only' → neutralisé en test.
vi.mock('server-only', () => ({}));

import { analyzeMicronutrientIntake, type LoggedDay } from './intake-analysis';

function day(date: string, ...items: Array<{ name: string; qty_g: number }>): LoggedDay {
  return { date, items };
}
const REAL_FOODS = [
  { name: 'poulet', qty_g: 150 },
  { name: 'riz', qty_g: 200 },
  { name: 'épinard', qty_g: 100 },
  { name: 'oeuf', qty_g: 100 },
  { name: 'banane', qty_g: 120 },
];

describe('analyzeMicronutrientIntake (CIQUAL × cibles sportives)', () => {
  it('fiable avec ≥5 jours d’aliments identifiés', () => {
    const days = Array.from({ length: 6 }, (_, i) => day(`2026-01-0${i + 1}`, ...REAL_FOODS));
    const a = analyzeMicronutrientIntake(days, 'male');
    expect(a.days_analyzed).toBe(6);
    expect(a.items_matched).toBeGreaterThan(0);
    expect(a.match_rate).toBeGreaterThan(0.5);
    expect(a.reliable).toBe(true);
    expect(Array.isArray(a.low)).toBe(true);
    for (const l of a.low) {
      expect(l.target_per_day).toBeGreaterThan(0);
      expect(l.food_sources_fr.length).toBeGreaterThan(0);
      expect(l.avg_coverage_pct).toBeLessThan(70);
    }
    // diet_quality calculé (aliments bruts -> AUT ~0, densité protéique correcte)
    expect(a.diet_quality).not.toBeNull();
    expect(a.diet_quality!.aut_calorie_share).toBe(0);
    expect(a.diet_quality!.protein_per_100kcal).toBeGreaterThan(0);
  });

  it('NON fiable si trop peu de jours → pas de "low", note prudente', () => {
    const a = analyzeMicronutrientIntake(
      [day('2026-01-01', ...REAL_FOODS), day('2026-01-02', ...REAL_FOODS)],
      'female',
    );
    expect(a.reliable).toBe(false);
    expect(a.low).toEqual([]);
    expect(a.note).toMatch(/partiels|Ne PAS conclure/i);
  });

  it('NON fiable si aliments non identifiables (match faible) → aucune fausse carence', () => {
    const days = Array.from({ length: 6 }, (_, i) =>
      day(`2026-02-0${i + 1}`, { name: 'zzqxw vbnmlkj', qty_g: 100 }),
    );
    const a = analyzeMicronutrientIntake(days, 'male');
    expect(a.match_rate).toBeLessThan(0.5);
    expect(a.reliable).toBe(false);
    expect(a.low).toEqual([]);
  });

  it('tourne pour le sexe féminin (cible fer sportive plus haute)', () => {
    const days = Array.from({ length: 6 }, (_, i) => day(`2026-03-0${i + 1}`, { name: 'riz', qty_g: 200 }));
    const a = analyzeMicronutrientIntake(days, 'female');
    expect(a.reliable).toBe(true);
    // riz seul → forcément des apports bas (fer/B12/etc.)
    expect(a.low.length).toBeGreaterThan(0);
  });
});
