import { z } from 'zod';

export const BloodworkMarkerSchema = z.object({
  name: z.string().min(1),
  value: z.number(),
  unit: z.string(),
  referenceRange: z.string(),
  status: z.enum(['low', 'normal', 'high']),
});

export const BloodworkAnalysisSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format de date requis: YYYY-MM-DD"),
  markers: z.array(BloodworkMarkerSchema),
  summary: z.string(),
  recommendations: z.array(z.string()),
});

export type BloodworkMarker = z.infer<typeof BloodworkMarkerSchema>;
export type BloodworkAnalysis = z.infer<typeof BloodworkAnalysisSchema>;
