import { z } from 'zod';

/**
 * Canonical food log schema — fondation A.0 for M1 (photo-meal),
 * M2 (barcode), M3 (voice), M14 (recipe OCR), M15 (micronutrients).
 *
 * Path: users/{uid}/food_logs/{logId}
 * Convention: snake_case (cohérent avec checkins_daily, plans, etc.)
 */

export const FoodLogSourceSchema = z.enum([
  'photo_meal',
  'barcode',
  'voice',
  'recipe',
  'manual',
  'recipe_ocr',
]);

export type FoodLogSource = z.infer<typeof FoodLogSourceSchema>;

export const FoodLogItemSchema = z.object({
  name: z.string(),
  brand: z.string().optional(),
  barcode: z.string().optional(),
  qty_g: z.number().nonnegative(),
  kcal: z.number().nonnegative(),
  p: z.number().nonnegative(),
  c: z.number().nonnegative(),
  f: z.number().nonnegative(),
  fiber_g: z.number().nonnegative().optional(),
  sodium_mg: z.number().nonnegative().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export type FoodLogItem = z.infer<typeof FoodLogItemSchema>;

export const FoodLogTotalsSchema = z.object({
  kcal: z.number().nonnegative(),
  p: z.number().nonnegative(),
  c: z.number().nonnegative(),
  f: z.number().nonnegative(),
});

export type FoodLogTotals = z.infer<typeof FoodLogTotalsSchema>;

export const FoodLogSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  meal_slot: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).optional(),
  source: FoodLogSourceSchema,
  items: z.array(FoodLogItemSchema).min(1),
  totals: FoodLogTotalsSchema,
  notes: z.string().optional(),
  storage_path: z.string().optional(),
  logged_at: z.string(),
});

export type FoodLog = z.infer<typeof FoodLogSchema>;

export function computeTotals(items: FoodLogItem[]): FoodLogTotals {
  return items.reduce<FoodLogTotals>(
    (acc, it) => ({
      kcal: acc.kcal + it.kcal,
      p: acc.p + it.p,
      c: acc.c + it.c,
      f: acc.f + it.f,
    }),
    { kcal: 0, p: 0, c: 0, f: 0 }
  );
}

export function newFoodLog(input: Omit<FoodLog, 'totals' | 'logged_at'> & { logged_at?: string }): FoodLog {
  const totals = computeTotals(input.items);
  return FoodLogSchema.parse({
    ...input,
    totals,
    logged_at: input.logged_at ?? new Date().toISOString(),
  });
}
