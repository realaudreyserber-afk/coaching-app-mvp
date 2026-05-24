import { z } from 'zod';

export const GLP1MedicationSchema = z.object({
  active: z.boolean().default(false),
  molecule: z.enum(['semaglutide', 'tirzepatide', 'liraglutide', 'other']).default('semaglutide'),
  dose: z.string().optional().default(''), // e.g. "0.25mg" or "2.4mg"
  frequency: z.enum(['weekly', 'daily', 'other']).default('weekly'),
  startDate: z.string().optional().default(''), // YYYY-MM-DD
  sideEffects: z.array(z.string()).optional().default([]),
});

export type GLP1Medication = z.infer<typeof GLP1MedicationSchema>;
