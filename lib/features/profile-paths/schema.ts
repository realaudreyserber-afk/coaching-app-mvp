import { z } from 'zod';

export const ProfilePathSchema = z.enum([
  'standard',
  'high-bf',
  'ex-athlete',
  'glp1',
  'post-bariatric'
]);

export type ProfilePath = z.infer<typeof ProfilePathSchema>;
