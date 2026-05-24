import { z } from 'zod';

export const FcmTokenRegistrationSchema = z.object({
  token: z.string().min(10, "Le jeton de notification FCM est requis"),
});

export type FcmTokenRegistration = z.infer<typeof FcmTokenRegistrationSchema>;
