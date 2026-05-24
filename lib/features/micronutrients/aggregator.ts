/**
 * M15 — Micronutrients daily aggregator.
 *
 * Reads users/{uid}/food_logs/{logId} for a given date, sums micronutrient
 * intake across items (fiber, sodium, vitamins, minerals when available
 * from OFF entries cached in content/foods/items/{barcode}).
 *
 * Returns daily intake + AJR coverage % for 14 reference micronutrients.
 *
 * NB: only fiber + sodium are populated today from OFF base. The 14-marker
 * coverage will fill in as M6 ingestion enriches the content/foods catalog
 * (or as user manually inputs detailed items).
 */
import type { FoodLog, FoodLogItem } from '../food-logs/schema';

export interface MicronutrientItem extends FoodLogItem {
  // Optional extended fields populated by enrichFromFoodsBase()
  vit_a_mcg?: number;
  vit_c_mg?: number;
  vit_d_mcg?: number;
  vit_e_mg?: number;
  vit_k_mcg?: number;
  vit_b1_mg?: number;
  vit_b2_mg?: number;
  vit_b6_mg?: number;
  vit_b9_mcg?: number;
  vit_b12_mcg?: number;
  calcium_mg?: number;
  magnesium_mg?: number;
  potassium_mg?: number;
  iron_mg?: number;
  zinc_mg?: number;
  selenium_mcg?: number;
  iodine_mcg?: number;
}

export interface DailyMicroIntake {
  date: string;
  fiber_g: number;
  sodium_mg: number;
  vit_a_mcg: number;
  vit_c_mg: number;
  vit_d_mcg: number;
  vit_e_mg: number;
  vit_k_mcg: number;
  vit_b1_mg: number;
  vit_b2_mg: number;
  vit_b6_mg: number;
  vit_b9_mcg: number;
  vit_b12_mcg: number;
  calcium_mg: number;
  magnesium_mg: number;
  potassium_mg: number;
  iron_mg: number;
  zinc_mg: number;
  selenium_mcg: number;
  iodine_mcg: number;
}

// Reference Daily Intake (EFSA, adulte moyen) — used for coverage % calc
export const RDI: Omit<DailyMicroIntake, 'date'> = {
  fiber_g: 30,
  sodium_mg: 2300,
  vit_a_mcg: 800,
  vit_c_mg: 90,
  vit_d_mcg: 15,
  vit_e_mg: 13,
  vit_k_mcg: 75,
  vit_b1_mg: 1.1,
  vit_b2_mg: 1.4,
  vit_b6_mg: 1.4,
  vit_b9_mcg: 330,
  vit_b12_mcg: 4,
  calcium_mg: 950,
  magnesium_mg: 350,
  potassium_mg: 3500,
  iron_mg: 11,
  zinc_mg: 9.4,
  selenium_mcg: 70,
  iodine_mcg: 150,
};

function blankIntake(date: string): DailyMicroIntake {
  return {
    date,
    fiber_g: 0,
    sodium_mg: 0,
    vit_a_mcg: 0,
    vit_c_mg: 0,
    vit_d_mcg: 0,
    vit_e_mg: 0,
    vit_k_mcg: 0,
    vit_b1_mg: 0,
    vit_b2_mg: 0,
    vit_b6_mg: 0,
    vit_b9_mcg: 0,
    vit_b12_mcg: 0,
    calcium_mg: 0,
    magnesium_mg: 0,
    potassium_mg: 0,
    iron_mg: 0,
    zinc_mg: 0,
    selenium_mcg: 0,
    iodine_mcg: 0,
  };
}

export function aggregateMicronutrients(date: string, logs: FoodLog[]): DailyMicroIntake {
  const out = blankIntake(date);

  for (const log of logs) {
    for (const it of log.items as MicronutrientItem[]) {
      const scale = it.qty_g / 100;

      if (typeof it.fiber_g === 'number') out.fiber_g += it.fiber_g * scale;
      if (typeof it.sodium_mg === 'number') out.sodium_mg += it.sodium_mg * scale;
      if (typeof it.vit_a_mcg === 'number') out.vit_a_mcg += it.vit_a_mcg * scale;
      if (typeof it.vit_c_mg === 'number') out.vit_c_mg += it.vit_c_mg * scale;
      if (typeof it.vit_d_mcg === 'number') out.vit_d_mcg += it.vit_d_mcg * scale;
      if (typeof it.vit_e_mg === 'number') out.vit_e_mg += it.vit_e_mg * scale;
      if (typeof it.vit_k_mcg === 'number') out.vit_k_mcg += it.vit_k_mcg * scale;
      if (typeof it.vit_b1_mg === 'number') out.vit_b1_mg += it.vit_b1_mg * scale;
      if (typeof it.vit_b2_mg === 'number') out.vit_b2_mg += it.vit_b2_mg * scale;
      if (typeof it.vit_b6_mg === 'number') out.vit_b6_mg += it.vit_b6_mg * scale;
      if (typeof it.vit_b9_mcg === 'number') out.vit_b9_mcg += it.vit_b9_mcg * scale;
      if (typeof it.vit_b12_mcg === 'number') out.vit_b12_mcg += it.vit_b12_mcg * scale;
      if (typeof it.calcium_mg === 'number') out.calcium_mg += it.calcium_mg * scale;
      if (typeof it.magnesium_mg === 'number') out.magnesium_mg += it.magnesium_mg * scale;
      if (typeof it.potassium_mg === 'number') out.potassium_mg += it.potassium_mg * scale;
      if (typeof it.iron_mg === 'number') out.iron_mg += it.iron_mg * scale;
      if (typeof it.zinc_mg === 'number') out.zinc_mg += it.zinc_mg * scale;
      if (typeof it.selenium_mcg === 'number') out.selenium_mcg += it.selenium_mcg * scale;
      if (typeof it.iodine_mcg === 'number') out.iodine_mcg += it.iodine_mcg * scale;
    }
  }

  return out;
}

export function coveragePct(intake: DailyMicroIntake): Record<keyof Omit<DailyMicroIntake, 'date'>, number> {
  const out = {} as Record<keyof Omit<DailyMicroIntake, 'date'>, number>;
  for (const key of Object.keys(RDI) as Array<keyof typeof RDI>) {
    const value = intake[key];
    const ref = RDI[key];
    out[key] = ref > 0 ? Math.round((value / ref) * 1000) / 10 : 0; // %, 1 décimale
  }
  return out;
}

/**
 * Detect chronic deficits (< 70% AJR sur 14j moyenne).
 */
export function detectDeficits(history: DailyMicroIntake[]): Array<{
  nutrient: keyof Omit<DailyMicroIntake, 'date'>;
  avg_coverage_pct: number;
}> {
  if (history.length < 7) return [];
  const sums = blankIntake('');
  for (const day of history) {
    for (const key of Object.keys(RDI) as Array<keyof typeof RDI>) {
      sums[key] += day[key];
    }
  }
  const avgIntake: DailyMicroIntake = { ...sums, date: '' };
  for (const key of Object.keys(RDI) as Array<keyof typeof RDI>) {
    avgIntake[key] = sums[key] / history.length;
  }
  const coverage = coveragePct(avgIntake);
  return (Object.keys(coverage) as Array<keyof typeof coverage>)
    .filter((k) => coverage[k] < 70 && coverage[k] > 0)
    .map((k) => ({ nutrient: k, avg_coverage_pct: coverage[k] }));
}
