import { describe, it, expect, vi } from 'vitest';

// 'server-only' jette hors d'un Server Component → on le neutralise en test
// (même pattern que les tests des sous-agents).
vi.mock('server-only', () => ({}));

import {
  getFoodByCode,
  searchFoods,
  matchFood,
  nutrientsForPortion,
  foodCount,
} from './index';

describe('food-composition (CIQUAL 2025)', () => {
  it('charge la table (> 3000 aliments)', () => {
    expect(foodCount()).toBeGreaterThan(3000);
  });

  it('recherche tolérante aux accents (epinard -> Épinard) + composition réelle', () => {
    const hits = searchFoods('epinard cuit');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].name.toLowerCase()).toContain('pinard');
    expect(hits[0].per100g.iron_mg).toBeGreaterThan(0);
  });

  it('matchFood renvoie un aliment protéiné plausible (poulet)', () => {
    const f = matchFood('poulet rôti');
    expect(f).not.toBeNull();
    expect(f!.per100g.protein_g).toBeGreaterThan(15);
  });

  it('saumon : riche en B12 et DHA (clés sportives)', () => {
    const f = matchFood('saumon cuit');
    expect(f).not.toBeNull();
    expect(f!.per100g.vit_b12_mcg).toBeGreaterThan(1);
    expect(f!.per100g.dha_g).toBeGreaterThan(0.3);
  });

  it('portion : scale proportionnel', () => {
    const f = matchFood('oeuf dur') ?? matchFood('oeuf');
    expect(f).not.toBeNull();
    const p200 = nutrientsForPortion(f!, 200);
    expect(p200.protein_g).toBeCloseTo(f!.per100g.protein_g * 2, 1);
  });

  it('getFoodByCode round-trip', () => {
    const code = searchFoods('saumon', 1)[0].code;
    expect(getFoodByCode(code)?.code).toBe(code);
    expect(getFoodByCode('___inexistant___')).toBeNull();
  });
});
