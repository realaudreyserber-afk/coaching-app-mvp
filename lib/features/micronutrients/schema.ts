import { z } from 'zod';

export const MicronutrientsSchema = z.object({
  calcium: z.number().default(0), // mg
  magnesium: z.number().default(0), // mg
  potassium: z.number().default(0), // mg
  iron: z.number().default(0), // mg
  zinc: z.number().default(0), // mg
  sodium: z.number().default(0), // mg (1g sodium = 2.5g salt)
  vitaminA: z.number().default(0), // mcg RE
  vitaminC: z.number().default(0), // mg
  vitaminD: z.number().default(0), // mcg
  vitaminE: z.number().default(0), // mg
  vitaminK: z.number().default(0), // mcg
  vitaminB6: z.number().default(0), // mg
  vitaminB9: z.number().default(0), // mcg (folates)
  vitaminB12: z.number().default(0), // mcg
});

export type Micronutrients = z.infer<typeof MicronutrientsSchema>;

export const DailyMicronutrientsSchema = z.object({
  date: z.string(), // YYYY-MM-DD
  values: MicronutrientsSchema,
  updatedAt: z.string(),
});

export type DailyMicronutrients = z.infer<typeof DailyMicronutrientsSchema>;

// Standard adult Recommended Daily Allowances (RDA) (French ANC / EFSA reference values)
export const MICRONUTRIENT_RDA: Record<keyof Micronutrients, { name: string; unit: string; value: number }> = {
  calcium: { name: 'Calcium', unit: 'mg', value: 950 },
  magnesium: { name: 'Magnésium', unit: 'mg', value: 380 },
  potassium: { name: 'Potassium', unit: 'mg', value: 3500 },
  iron: { name: 'Fer', unit: 'mg', value: 11 },
  zinc: { name: 'Zinc', unit: 'mg', value: 10 },
  sodium: { name: 'Sodium', unit: 'mg', value: 2000 }, // Max limit recommendation
  vitaminA: { name: 'Vitamine A', unit: 'µg', value: 750 },
  vitaminC: { name: 'Vitamine C', unit: 'mg', value: 110 },
  vitaminD: { name: 'Vitamine D', unit: 'µg', value: 15 },
  vitaminE: { name: 'Vitamine E', unit: 'mg', value: 10 },
  vitaminK: { name: 'Vitamine K', unit: 'µg', value: 70 },
  vitaminB6: { name: 'Vitamine B6', unit: 'mg', value: 1.6 },
  vitaminB9: { name: 'Vitamine B9', unit: 'µg', value: 330 },
  vitaminB12: { name: 'Vitamine B12', unit: 'µg', value: 4 },
};
