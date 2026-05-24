import { z } from 'zod';

export const ReferralDataSchema = z.object({
  code: z.string().min(6), // Unique 6-character alphanumeric referral code
  referredBy: z.string().nullable().optional(), // UID of user who referred this user
  referredUsers: z.array(z.string()).default([]), // UIDs of users referred by this user
  premiumCredits: z.number().default(0), // Free premium months earned
  updatedAt: z.string(),
});

export type ReferralData = z.infer<typeof ReferralDataSchema>;
