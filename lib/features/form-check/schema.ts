import { z } from 'zod';

export const FormCheckResultSchema = z.object({
  exercise: z.string().min(1, "Le nom de l'exercice est requis"),
  score: z.number().min(1).max(10),
  observations: z.array(z.string()),
  recommendations: z.array(z.string()),
  safetyAlerts: z.array(z.string()),
});

export type FormCheckResult = z.infer<typeof FormCheckResultSchema>;
