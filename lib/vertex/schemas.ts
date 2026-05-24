import { z } from 'zod';

// Schema for Safety Layer output
export const SafetySchema = z.object({
  flagged: z.boolean(),
  reason: z.enum(['TCA', 'SUICIDE', 'UNDERWEIGHT', 'EXTREME_LOSS']).nullable(),
  message: z.string().nullable(),
});

export type SafetyOutput = z.infer<typeof SafetySchema>;

// Schema for Plan Generation output
export const PlanSchema = z.object({
  kcal: z.number(),
  macros: z.object({
    p: z.number(),
    c: z.number(),
    f: z.number(),
  }),
  meals_template: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      approx_kcal: z.number(),
    })
  ),
  training: z.object({
    sessions: z.array(
      z.object({
        name: z.string(),
        frequency_weekly: z.number(),
        exercises: z.array(
          z.object({
            name: z.string(),
            sets: z.number(),
            reps: z.string(),
            rest_seconds: z.number(),
          })
        ),
      })
    ),
  }),
  cardio: z.object({
    type: z.string(),
    duration_minutes: z.number(),
    frequency_weekly: z.number(),
    intensity: z.enum(['basse', 'modérée', 'haute']),
  }),
  supplements: z.array(
    z.object({
      name: z.string(),
      dosage: z.string(),
      timing: z.string(),
    })
  ),
  lifestyle_notes: z.string(),
  justification: z.string(),
});

export type PlanOutput = z.infer<typeof PlanSchema>;

// Schema for Weekly Review output
export const WeeklyReviewSchema = z.object({
  summary: z.string(),
  diagnostic: z.string(),
  adherence_score: z.number().min(0).max(100),
  should_adjust_plan: z.boolean(),
  adjustments_suggestion: z.string(),
});

export type WeeklyReviewOutput = z.infer<typeof WeeklyReviewSchema>;

// Schema for Daily Insight output
export const DailyInsightSchema = z.object({
  insight: z.string(),
  wellbeing_alert: z.boolean(),
});

export type DailyInsightOutput = z.infer<typeof DailyInsightSchema>;

// Schema for Progress Photo Vision Analysis
export const VisionAnalysisSchema = z.object({
  bf_estimated: z.number(),
  quality_score: z.number().min(1).max(10),
  quality_feedback: z.string(),
  visual_observations: z.string(),
  progress_analysis: z.string().nullable(),
});

export type VisionAnalysisOutput = z.infer<typeof VisionAnalysisSchema>;
