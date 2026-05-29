import { describe, it, expect } from 'vitest';
import {
  NUTRIENT_REFERENCE,
  NUTRIENT_BY_KEY,
  getNutrient,
  nutrientsByCategory,
  rdaForSex,
} from './nutrients';

describe('nutrient reference DB', () => {
  it('clés uniques', () => {
    const keys = NUTRIENT_REFERENCE.map((n) => n.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('couvre macros + micros (≥ 30 nutriments)', () => {
    expect(NUTRIENT_REFERENCE.length).toBeGreaterThanOrEqual(30);
    expect(nutrientsByCategory('macronutrient').length).toBeGreaterThan(0);
    expect(nutrientsByCategory('vitamin_fat_soluble').length).toBe(4);
    expect(nutrientsByCategory('trace_element').length).toBeGreaterThanOrEqual(9);
  });

  it('chaque entrée a les champs requis + valeurs cohérentes', () => {
    for (const n of NUTRIENT_REFERENCE) {
      expect(n.key).toMatch(/^[a-z0-9_]+$/);
      expect(n.name_fr.length).toBeGreaterThan(0);
      expect(n.unit.length).toBeGreaterThan(0);
      expect(n.role_fr.length).toBeGreaterThan(0);
      expect(n.deficiency_fr.length).toBeGreaterThan(0);
      expect(n.food_sources_fr.length).toBeGreaterThan(0);
      if (n.rda_male !== null) expect(n.rda_male).toBeGreaterThan(0);
      if (n.rda_female !== null) expect(n.rda_female).toBeGreaterThan(0);
      // UL (si défini) ≥ AJR
      const r = n.rda_male ?? n.rda_female;
      if (n.upper_limit != null && r != null) {
        expect(n.upper_limit).toBeGreaterThanOrEqual(r);
      }
    }
  });

  it('les macros énergétiques ont une densité kcal/g', () => {
    expect(getNutrient('protein_g')?.energy_kcal_per_g).toBe(4);
    expect(getNutrient('carb_g')?.energy_kcal_per_g).toBe(4);
    expect(getNutrient('fat_g')?.energy_kcal_per_g).toBe(9);
  });

  it('fer : AJR femme > homme (menstruation)', () => {
    const fe = getNutrient('iron_mg')!;
    expect(fe.rda_female! > fe.rda_male!).toBe(true);
    expect(rdaForSex(fe, 'female')).toBe(18);
    expect(rdaForSex(fe, 'male')).toBe(8);
    expect(rdaForSex(fe, null)).toBe(8); // fallback rda_male
  });

  it('clés micros alignées sur DailyMicroIntake (interop)', () => {
    for (const k of ['iron_mg', 'vit_c_mg', 'calcium_mg', 'magnesium_mg', 'vit_d_mcg', 'zinc_mg']) {
      expect(NUTRIENT_BY_KEY[k]).toBeDefined();
    }
  });

  it('NUTRIENT_BY_KEY indexe toutes les entrées', () => {
    expect(Object.keys(NUTRIENT_BY_KEY).length).toBe(NUTRIENT_REFERENCE.length);
  });
});
