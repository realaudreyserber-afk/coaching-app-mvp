import { describe, it, expect } from 'vitest';
import { groupSupplementsByMeal } from './group-supplements';

const meals = [
  { name: 'Petit-déjeuner', description: 'Œufs + flocons', approx_kcal: 600 },
  { name: 'Déjeuner', description: 'Poulet + riz', approx_kcal: 800 },
  { name: 'Collation après-midi', description: 'Yaourt grec', approx_kcal: 200 },
  { name: 'Dîner', description: 'Saumon + légumes', approx_kcal: 700 },
];

describe('groupSupplementsByMeal', () => {
  it('matches exact meal name', () => {
    const out = groupSupplementsByMeal(meals, [
      { name: 'Vitamine D', dosage: '1000 UI', timing: 'Petit-déjeuner' },
    ]);
    expect(out.meals[0].supplements).toHaveLength(1);
    expect(out.meals[0].supplements[0].name).toBe('Vitamine D');
    expect(out.orphans).toHaveLength(0);
  });

  it('matches accent-insensitive (petit-dejeuner vs Petit-déjeuner)', () => {
    const out = groupSupplementsByMeal(meals, [
      { name: 'Oméga 3', dosage: '2g', timing: 'petit-dejeuner' },
    ]);
    expect(out.meals[0].supplements).toHaveLength(1);
  });

  it('matches when meal name is substring of timing ("avec le déjeuner")', () => {
    const out = groupSupplementsByMeal(meals, [
      { name: 'Magnésium', dosage: '300 mg', timing: 'avec le déjeuner' },
    ]);
    expect(out.meals[1].supplements).toHaveLength(1);
    expect(out.meals[1].supplements[0].name).toBe('Magnésium');
  });

  it('puts unmatched timings in orphans bucket', () => {
    const out = groupSupplementsByMeal(meals, [
      { name: 'Mélatonine', dosage: '0.3 mg', timing: '30 min avant le coucher' },
    ]);
    expect(out.orphans).toHaveLength(1);
    expect(out.orphans[0].name).toBe('Mélatonine');
    expect(out.meals.every((m) => m.supplements.length === 0)).toBe(true);
  });

  it('handles multiple supplements per meal', () => {
    const out = groupSupplementsByMeal(meals, [
      { name: 'Vitamine D', dosage: '1000 UI', timing: 'Petit-déjeuner' },
      { name: 'Oméga 3', dosage: '2g', timing: 'Petit-déjeuner' },
    ]);
    expect(out.meals[0].supplements).toHaveLength(2);
  });

  it('returns empty meals + empty orphans for missing inputs', () => {
    const out = groupSupplementsByMeal(undefined, undefined);
    expect(out.meals).toEqual([]);
    expect(out.orphans).toEqual([]);
  });

  it('passes meals through unchanged when no supplements', () => {
    const out = groupSupplementsByMeal(meals, []);
    expect(out.meals).toHaveLength(4);
    expect(out.meals.every((m) => m.supplements.length === 0)).toBe(true);
  });

  it('matches "Collation après-midi" when timing contains it', () => {
    const out = groupSupplementsByMeal(meals, [
      { name: 'Whey', dosage: '30g', timing: 'pendant la Collation après-midi' },
    ]);
    expect(out.meals[2].supplements).toHaveLength(1);
  });
});
