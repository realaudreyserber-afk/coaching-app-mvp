import { Micronutrients } from './schema';
import { findLocalFoodProfile } from './reference-db';

interface FoodLogItem {
  name: string;
  qty_g: number;
  rawOffData?: any; // Open Food Facts raw product details if scanned
}

/**
 * Calculates cumulative micronutrients for a list of daily logged food items.
 * Enforces zero dynamic AI estimation to prevent hallucinations.
 */
export function calculateDailyMicronutrients(logs: FoodLogItem[]): Micronutrients {
  const totals: Micronutrients = {
    calcium: 0,
    magnesium: 0,
    potassium: 0,
    iron: 0,
    zinc: 0,
    sodium: 0,
    vitaminA: 0,
    vitaminC: 0,
    vitaminD: 0,
    vitaminE: 0,
    vitaminK: 0,
    vitaminB6: 0,
    vitaminB9: 0,
    vitaminB12: 0,
  };

  for (const log of logs) {
    const qtyFactor = log.qty_g / 100;
    let foundProfile = false;

    // 1. Try to parse from Open Food Facts raw data if present
    if (log.rawOffData?.nutriments) {
      const nut = log.rawOffData.nutriments;
      
      // OFF values are typically in g per 100g, we need to convert to our schema units:
      // - calcium: mg (OFF has 'calcium_100g' in g, so * 1000 to get mg)
      // - magnesium: mg (OFF in g, so * 1000)
      // - potassium: mg (OFF in g, so * 1000)
      // - iron: mg (OFF in g, so * 1000)
      // - zinc: mg (OFF in g, so * 1000)
      // - sodium: mg (OFF in g, so * 1000)
      // - vitaminA: mcg (OFF in g, so * 1000000)
      // - vitaminC: mg (OFF in g, so * 1000)
      // - vitaminD: mcg (OFF in g, so * 1000000)
      // - vitaminE: mg (OFF in g, so * 1000)
      // - vitaminK: mcg (OFF in g, so * 1000000)
      // - vitaminB6: mg (OFF in g, so * 1000)
      // - vitaminB9: mcg (OFF in g, so * 1000000)
      // - vitaminB12: mcg (OFF in g, so * 1000000)
      
      const getVal = (key: string, multiplier: number): number => {
        const val = nut[`${key}_100g`] || nut[key];
        return typeof val === 'number' ? val * multiplier : 0;
      };

      const offCalcium = getVal('calcium', 1000);
      const offMagnesium = getVal('magnesium', 1000);
      const offPotassium = getVal('potassium', 1000);
      const offIron = getVal('iron', 1000);
      const offZinc = getVal('zinc', 1000);
      const offSodium = getVal('sodium', 1000);
      const offVitA = getVal('vitamin-a', 1000000);
      const offVitC = getVal('vitamin-c', 1000);
      const offVitD = getVal('vitamin-d', 1000000);
      const offVitE = getVal('vitamin-e', 1000);
      const offVitK = getVal('vitamin-k', 1000000);
      const offVitB6 = getVal('vitamin-b6', 1000);
      const offVitB9 = getVal('vitamin-b9', 1000000);
      const offVitB12 = getVal('vitamin-b12', 1000000);

      // If we found any actual mineral/vitamin values in OFF, apply them
      if (
        offCalcium > 0 || offMagnesium > 0 || offPotassium > 0 || 
        offIron > 0 || offZinc > 0 || offSodium > 0 || 
        offVitA > 0 || offVitC > 0 || offVitD > 0 || 
        offVitE > 0 || offVitK > 0 || offVitB6 > 0 || 
        offVitB9 > 0 || offVitB12 > 0
      ) {
        totals.calcium += offCalcium * qtyFactor;
        totals.magnesium += offMagnesium * qtyFactor;
        totals.potassium += offPotassium * qtyFactor;
        totals.iron += offIron * qtyFactor;
        totals.zinc += offZinc * qtyFactor;
        totals.sodium += offSodium * qtyFactor;
        totals.vitaminA += offVitA * qtyFactor;
        totals.vitaminC += offVitC * qtyFactor;
        totals.vitaminD += offVitD * qtyFactor;
        totals.vitaminE += offVitE * qtyFactor;
        totals.vitaminK += offVitK * qtyFactor;
        totals.vitaminB6 += offVitB6 * qtyFactor;
        totals.vitaminB9 += offVitB9 * qtyFactor;
        totals.vitaminB12 += offVitB12 * qtyFactor;
        foundProfile = true;
      }
    }

    // 2. Fallback to local USDA/Ciqual reference database if OFF data didn't yield micronutrients
    if (!foundProfile) {
      const profile = findLocalFoodProfile(log.name);
      if (profile) {
        const p = profile.nutrients100g;
        totals.calcium += p.calcium * qtyFactor;
        totals.magnesium += p.magnesium * qtyFactor;
        totals.potassium += p.potassium * qtyFactor;
        totals.iron += p.iron * qtyFactor;
        totals.zinc += p.zinc * qtyFactor;
        totals.sodium += p.sodium * qtyFactor;
        totals.vitaminA += p.vitaminA * qtyFactor;
        totals.vitaminC += p.vitaminC * qtyFactor;
        totals.vitaminD += p.vitaminD * qtyFactor;
        totals.vitaminE += p.vitaminE * qtyFactor;
        totals.vitaminK += p.vitaminK * qtyFactor;
        totals.vitaminB6 += p.vitaminB6 * qtyFactor;
        totals.vitaminB9 += p.vitaminB9 * qtyFactor;
        totals.vitaminB12 += p.vitaminB12 * qtyFactor;
      }
      // If not found, we add 0 (strict compliance: no hallucinations)
    }
  }

  // Round values nicely for display
  return {
    calcium: Math.round(totals.calcium),
    magnesium: Math.round(totals.magnesium),
    potassium: Math.round(totals.potassium),
    iron: Math.round(totals.iron * 10) / 10,
    zinc: Math.round(totals.zinc * 10) / 10,
    sodium: Math.round(totals.sodium),
    vitaminA: Math.round(totals.vitaminA),
    vitaminC: Math.round(totals.vitaminC),
    vitaminD: Math.round(totals.vitaminD * 10) / 10,
    vitaminE: Math.round(totals.vitaminE * 10) / 10,
    vitaminK: Math.round(totals.vitaminK),
    vitaminB6: Math.round(totals.vitaminB6 * 100) / 100,
    vitaminB9: Math.round(totals.vitaminB9),
    vitaminB12: Math.round(totals.vitaminB12 * 100) / 100,
  };
}
