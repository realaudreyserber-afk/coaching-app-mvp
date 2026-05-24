import { z } from 'zod';

export const MicroTaskSchema = z.object({
  id: z.string(),
  text: z.string(),
  category: z.enum(['nutrition', 'lifestyle', 'training']),
});

export type MicroTask = z.infer<typeof MicroTaskSchema>;

export const MicroTaskCompletionSchema = z.object({
  taskId: z.string(),
  completed: z.boolean(),
  completedAt: z.string(), // ISO String
});

export type MicroTaskCompletion = z.infer<typeof MicroTaskCompletionSchema>;
