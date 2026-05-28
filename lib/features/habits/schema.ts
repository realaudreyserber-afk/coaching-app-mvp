/**
 * Phase 11 data-layer — Habitudes long-terme.
 *
 * Stockage :
 *   - users/{uid}/habits/{habitId}        → définition de l'habitude (active)
 *   - users/{uid}/habit_logs/{logId}      → 1 log par habit × jour, doc id = {date}_{habitId}
 *
 * Distinction vs daily_tasks : daily_tasks est ponctuel (micro-tâche du jour
 * proposée par le coach). Habits = ancré, récurrent, choisi par l'user.
 * Ex: "matin: 30g protéine avant 9h", "soir: pas d'écran après 22h".
 */

import { z } from 'zod';

export const HabitCategorySchema = z.enum(['morning', 'evening', 'meal', 'training', 'recovery', 'mental', 'other']);
export type HabitCategory = z.infer<typeof HabitCategorySchema>;

export const HabitFrequencySchema = z.enum(['daily', 'weekly_n', 'specific_days']);
export type HabitFrequency = z.infer<typeof HabitFrequencySchema>;

export const HabitSchema = z.object({
  name: z.string().max(100),
  category: HabitCategorySchema,
  /** HH:MM si target_time pertinent (optionnel) */
  target_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  frequency: HabitFrequencySchema.default('daily'),
  /** Si frequency=specific_days : 0=dimanche, 1=lundi, ..., 6=samedi */
  days_of_week: z.array(z.number().int().min(0).max(6)).optional(),
  /** Si frequency=weekly_n : nombre cible / semaine */
  weekly_target_count: z.number().int().min(1).max(7).optional(),
  active: z.boolean().default(true),
  created_at: z.string().optional(),
  /** Stats agrégées (denormalized) — update à chaque log */
  current_streak: z.number().int().min(0).default(0),
  longest_streak: z.number().int().min(0).default(0),
  total_completions: z.number().int().min(0).default(0),
});

export type Habit = z.infer<typeof HabitSchema>;

export const HabitLogSchema = z.object({
  /** YYYY-MM-DD */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  habit_id: z.string(),
  completed: z.boolean(),
  note: z.string().max(200).optional(),
  /** Timestamp serveur */
  logged_at: z.string().optional(),
});

export type HabitLog = z.infer<typeof HabitLogSchema>;

/**
 * Détermine si une habitude est "due" aujourd'hui selon sa frequency.
 */
export function isHabitDueToday(habit: Habit, todayIso?: string): boolean {
  if (!habit.active) return false;
  const date = todayIso ? new Date(todayIso) : new Date();
  switch (habit.frequency) {
    case 'daily':
      return true;
    case 'specific_days':
      return (habit.days_of_week ?? []).includes(date.getDay());
    case 'weekly_n':
      // Always "due" — l'user choisit son jour dans la semaine
      return true;
  }
}
