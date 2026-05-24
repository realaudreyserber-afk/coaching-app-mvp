import { describe, it, expect } from 'vitest';
import { calculateDailyMicronutrients } from './micronutrient-calc';
import { findLocalFoodProfile, getNormalizedFoodKey } from './reference-db';

describe('Micronutrients Calculator & Reference DB', () => {
  it('should normalize names accurately', () => {
    expect(getNormalizedFoodKey("Riz Cuit")).toBe("riz cuit");
    expect(getNormalizedFoodKey("Blanc de Poulet !")).toBe("blanc de poulet");
    expect(getNormalizedFoodKey("Pâtés Cuites")).toBe("pates cuites");
  });

  it('should resolve profiles using fuzzy name matching', () => {
    const profile = findLocalFoodProfile("Riz cuit basmati");
    expect(profile).not.toBeNull();
    expect(profile?.name).toContain("Riz blanc cuit");
  });

  it('should compute micronutrients from local database profile', () => {
    const logs = [
      { name: "Riz cuit", qty_g: 200 }, // Magnesium is 12mg per 100g -> should be 24mg
      { name: "Blanc de poulet", qty_g: 150 }, // Calcium is 15mg per 100g -> should be 22.5mg -> total ~33mg
    ];

    const result = calculateDailyMicronutrients(logs);

    expect(result.magnesium).toBe(68); // (12 * 2) + (29 * 1.5) = 24 + 43.5 = 67.5 -> 68
    expect(result.calcium).toBe(43); // (10 * 2) + (15 * 1.5) = 20 + 22.5 = 42.5 -> 43
  });

  it('should parse Open Food Facts raw data correctly', () => {
    const logs = [
      {
        name: "Produit OFF Scanné",
        qty_g: 100,
        rawOffData: {
          nutriments: {
            calcium_100g: 0.12, // 0.12g = 120mg
            magnesium_100g: 0.04, // 40mg
            sodium_100g: 0.002, // 2mg
          }
        }
      }
    ];

    const result = calculateDailyMicronutrients(logs);
    expect(result.calcium).toBe(120);
    expect(result.magnesium).toBe(40);
  });

  it('should return zero micronutrients for unknown foods to prevent hallucinations', () => {
    const logs = [
      { name: "Aliment Mystère Inexistant", qty_g: 200 }
    ];

    const result = calculateDailyMicronutrients(logs);
    
    // All 14 targets should be 0
    expect(result.calcium).toBe(0);
    expect(result.magnesium).toBe(0);
    expect(result.iron).toBe(0);
    expect(result.vitaminD).toBe(0);
  });
});
