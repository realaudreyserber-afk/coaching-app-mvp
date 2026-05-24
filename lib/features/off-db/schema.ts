import { z } from 'zod';
import { FoodSchema, Food } from '../barcode/schema';

export { FoodSchema };
export type { Food };

export const CacheMetadataSchema = z.object({
  updatedAt: z.string(),
  hits: z.number().optional().default(0),
});

export type CacheMetadata = z.infer<typeof CacheMetadataSchema>;
