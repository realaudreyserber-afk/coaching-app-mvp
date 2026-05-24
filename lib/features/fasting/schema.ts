import { z } from 'zod';

export const FastingProtocolSchema = z.object({
  type: z.enum(['none', '16:8', '18:6', '20:4', 'OMAD', 'custom']),
  eating_window_start: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Format HH:MM requis"),
  eating_window_end: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Format HH:MM requis"),
  days_active: z.array(z.number().min(0).max(6)), // 0 = Sunday, 1 = Monday, etc.
  active: z.boolean(),
});

export type FastingProtocol = z.infer<typeof FastingProtocolSchema>;
