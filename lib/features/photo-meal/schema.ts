import { z } from 'zod';

export const PhotoMealItemSchema = z.object({
  name: z.string(),
  qty_estimated_g: z.number(),
  kcal: z.number(),
  p: z.number(),
  c: z.number(),
  f: z.number(),
  confidence: z.number(), // 0.0 to 1.0
});

export const PhotoMealAnalysisSchema = z.object({
  items: z.array(PhotoMealItemSchema),
  total: z.object({
    kcal: z.number(),
    p: z.number(),
    c: z.number(),
    f: z.number(),
  }),
});

export type PhotoMealItem = z.infer<typeof PhotoMealItemSchema>;
export type PhotoMealAnalysis = z.infer<typeof PhotoMealAnalysisSchema>;
