import { z } from 'zod';

export const RecipeIngredientSchema = z.object({
  name: z.string(),
  qty: z.number().min(0),
  unit: z.string(),
  kcal: z.number().optional(),
  p: z.number().optional(),
  c: z.number().optional(),
  f: z.number().optional(),
});

export const RecipeOcrResultSchema = z.object({
  name: z.string().min(1, "Le nom de la recette est requis"),
  ingredients: z.array(RecipeIngredientSchema),
  steps: z.array(z.string()),
  servings: z.number().min(1),
  totalKcal: z.number().min(0),
  totalP: z.number().min(0),
  totalC: z.number().min(0),
  totalF: z.number().min(0),
});

export type RecipeOcrResult = z.infer<typeof RecipeOcrResultSchema>;
