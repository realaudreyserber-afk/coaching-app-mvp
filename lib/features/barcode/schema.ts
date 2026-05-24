import { z } from 'zod';

export const OFFProductSchema = z.object({
  product_name: z.string().optional().default('Produit inconnu'),
  brands: z.string().optional().default('Marque inconnue'),
  nutriments: z.object({
    'energy-kcal_100g': z.number().optional().default(0),
    'energy-kcal': z.number().optional().default(0),
    proteins_100g: z.number().optional().default(0),
    carbohydrates_100g: z.number().optional().default(0),
    fat_100g: z.number().optional().default(0),
    fiber_100g: z.number().optional().default(0),
    sodium_100g: z.number().optional().default(0),
  }).optional().default({
    'energy-kcal_100g': 0,
    'energy-kcal': 0,
    proteins_100g: 0,
    carbohydrates_100g: 0,
    fat_100g: 0,
    fiber_100g: 0,
    sodium_100g: 0,
  }),
  allergens_tags: z.array(z.string()).optional().default([]),
  nutrition_grades: z.string().optional().default(''),
  nova_group: z.union([z.number(), z.string()]).optional().default(''),
  image_url: z.string().optional().default(''),
});

export const FoodSchema = z.object({
  id: z.string(), // normally barcode or custom ID
  barcode: z.string().optional(),
  name: z.string(),
  brand: z.string().optional(),
  kcal_100g: z.number(),
  p_100g: z.number(),
  c_100g: z.number(),
  f_100g: z.number(),
  fiber_100g: z.number().optional().default(0),
  sodium_100g: z.number().optional().default(0),
  allergens: z.array(z.string()).optional().default([]),
  nutriscore: z.string().optional(),
  novascore: z.number().optional(),
  imageUrl: z.string().optional(),
});

export type OFFProduct = z.infer<typeof OFFProductSchema>;
export type Food = z.infer<typeof FoodSchema>;
