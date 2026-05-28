/**
 * Suivi des substances impactant le coaching — Phase 5 data-layer.
 *
 * Couvre : caféine, alcool, nicotine, boissons énergisantes.
 *
 * Stockage : users/{uid}/substances_log/{YYYY-MM-DD} → entries[] du jour
 *
 * Impacts coaching :
 *   - Caféine > 400 mg/jour : sommeil + cortisol + craving sucré
 *   - Alcool en cut : lipogenèse + sommeil + recouvrance
 *   - Nicotine : récup + sommeil + densité osseuse
 *   - Energy drinks : combinaison caféine + sucre + parfois taurine
 */

import { z } from 'zod';

export const SubstanceTypeSchema = z.enum([
  'coffee', // expresso, americano, etc.
  'tea_caffeinated', // thé noir, vert, matcha
  'energy_drink', // RedBull, Monster, etc.
  'caffeine_pill', // pré-workout, NoDoz
  'alcohol_beer', // bière (ml)
  'alcohol_wine', // vin (ml)
  'alcohol_spirit', // alcool fort (cl)
  'alcohol_cocktail', // cocktail (servings)
  'nicotine_cigarette', // cigarette (unit)
  'nicotine_vape', // vape session (unit)
  'nicotine_pouch', // sachet/snus (unit)
  'other',
]);

export type SubstanceType = z.infer<typeof SubstanceTypeSchema>;

export const SubstanceEntrySchema = z.object({
  /** HH:MM */
  time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  type: SubstanceTypeSchema,
  /** Quantité — l'unité dépend du type (mg caféine, ml alcool, unité nicotine) */
  quantity: z.number().min(0).max(2000),
  /** Unité contextuelle ("mg", "ml", "cl", "unit", "serving") */
  unit: z.enum(['mg', 'ml', 'cl', 'unit', 'serving']),
  /** Note libre (ex: "café après déjeuner", "verre de vin au resto") */
  notes: z.string().max(200).optional(),
});

export type SubstanceEntry = z.infer<typeof SubstanceEntrySchema>;

export const SubstancesLogSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  entries: z.array(SubstanceEntrySchema).default([]),
  updated_at: z.string().optional(),
});

export type SubstancesLog = z.infer<typeof SubstancesLogSchema>;

/**
 * Estimations de caféine en mg par standard portion.
 */
const CAFFEINE_MG: Record<string, number> = {
  coffee: 95, // 1 tasse 240ml
  tea_caffeinated: 40, // 1 tasse 240ml
  energy_drink: 80, // 250ml
  caffeine_pill: 100, // par pilule standard
};

/**
 * Calcule le total caféine consommé (mg) à partir des entries.
 * Si entry.unit='mg' et type='caffeine_pill', utilise quantity direct.
 * Sinon estime depuis multiplicateur standard × (quantity unitaire / portion standard).
 */
export function totalCaffeineMg(entries: SubstanceEntry[]): number {
  let total = 0;
  for (const e of entries) {
    if (e.unit === 'mg') {
      total += e.quantity;
      continue;
    }
    const baseMg = CAFFEINE_MG[e.type];
    if (!baseMg) continue;
    // quantity représente le nombre de portions/unités
    total += baseMg * e.quantity;
  }
  return Math.round(total);
}

/**
 * Compte les unités d'alcool consommées.
 * Standard drink = 14g éthanol = 1 unité.
 * Bière 250ml 5% → 1 unité ; vin 100ml 12% → 1 unité ; spirit 30ml 40% → 1 unité.
 */
export function totalAlcoholUnits(entries: SubstanceEntry[]): number {
  let units = 0;
  for (const e of entries) {
    switch (e.type) {
      case 'alcohol_beer':
        // ml entry, 5% par défaut. 250ml @ 5% = 1 unité
        units += (e.quantity / 250) * 1;
        break;
      case 'alcohol_wine':
        // ml, 12%. 100ml @ 12% = 1 unité
        units += (e.quantity / 100) * 1;
        break;
      case 'alcohol_spirit':
        // cl, 40%. 3cl @ 40% = 1 unité
        units += (e.quantity / 3) * 1;
        break;
      case 'alcohol_cocktail':
        // serving, ~1.5 unité par cocktail standard
        units += e.quantity * 1.5;
        break;
    }
  }
  return Math.round(units * 10) / 10;
}

export function totalNicotineUnits(entries: SubstanceEntry[]): number {
  let total = 0;
  for (const e of entries) {
    if (
      e.type === 'nicotine_cigarette' ||
      e.type === 'nicotine_vape' ||
      e.type === 'nicotine_pouch'
    ) {
      total += e.quantity;
    }
  }
  return total;
}
