import { z } from 'zod';

export const BodyScannerAnalysisSchema = z.object({
  bf_pct_estimated: z.number(), // Estimated body fat percentage
  morphology_notes: z.array(z.string()),
  changes_vs_previous: z.array(z.string()).optional().default([]),
  asymmetries: z.array(z.string()).optional().default([]),
  posture_observations: z.array(z.string()),
});

export type BodyScannerAnalysis = z.infer<typeof BodyScannerAnalysisSchema>;
