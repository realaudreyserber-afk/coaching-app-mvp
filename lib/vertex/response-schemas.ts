/**
 * Gemini-compatible JSON schemas for structured outputs.
 * Mirror lib/vertex/schemas.ts (Zod) but in the format Vertex AI expects
 * via `responseSchema` field (subset of OpenAPI 3.0 Schema Object).
 */

export const PLAN_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    kcal: { type: 'number' },
    macros: {
      type: 'object',
      properties: {
        p: { type: 'number' },
        c: { type: 'number' },
        f: { type: 'number' },
      },
      required: ['p', 'c', 'f'],
    },
    meals_template: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          approx_kcal: { type: 'number' },
          // Wave 11A — items[] détaillé avec grammage + macros par aliment
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                food: { type: 'string' },
                grams: { type: 'number' },
                state: { type: 'string', enum: ['cru', 'cuit'] },
                kcal: { type: 'number' },
                p: { type: 'number' },
                c: { type: 'number' },
                f: { type: 'number' },
              },
              required: ['food', 'grams', 'kcal', 'p', 'c', 'f'],
            },
          },
          macros: {
            type: 'object',
            properties: {
              p: { type: 'number' },
              c: { type: 'number' },
              f: { type: 'number' },
            },
            required: ['p', 'c', 'f'],
          },
        },
        required: ['name', 'description', 'approx_kcal', 'items', 'macros'],
      },
    },
    training: {
      type: 'object',
      properties: {
        sessions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              frequency_weekly: { type: 'number' },
              exercises: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    sets: { type: 'number' },
                    reps: { type: 'string' },
                    rest_seconds: { type: 'number' },
                  },
                  required: ['name', 'sets', 'reps', 'rest_seconds'],
                },
              },
            },
            required: ['name', 'frequency_weekly', 'exercises'],
          },
        },
      },
      required: ['sessions'],
    },
    cardio: {
      type: 'object',
      properties: {
        type: { type: 'string' },
        duration_minutes: { type: 'number' },
        frequency_weekly: { type: 'number' },
        intensity: { type: 'string', enum: ['basse', 'modérée', 'haute'] },
      },
      required: ['type', 'duration_minutes', 'frequency_weekly', 'intensity'],
    },
    supplements: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          dosage: { type: 'string' },
          timing: { type: 'string' },
        },
        required: ['name', 'dosage', 'timing'],
      },
    },
    lifestyle_notes: { type: 'string' },
    justification: { type: 'string' },
  },
  required: ['kcal', 'macros', 'meals_template', 'training', 'cardio', 'lifestyle_notes', 'justification'],
} as const;

export const WEEKLY_REVIEW_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    diagnostic: { type: 'string' },
    adherence_score: { type: 'number' },
    should_adjust_plan: { type: 'boolean' },
    adjustments_suggestion: { type: 'string' },
  },
  required: ['summary', 'diagnostic', 'adherence_score', 'should_adjust_plan', 'adjustments_suggestion'],
} as const;

export const DAILY_INSIGHT_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    insight: { type: 'string' },
    wellbeing_alert: { type: 'boolean' },
  },
  required: ['insight', 'wellbeing_alert'],
} as const;

export const VISION_ANALYSIS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    bf_estimated: { type: 'number' },
    quality_score: { type: 'number' },
    quality_feedback: { type: 'string' },
    visual_observations: { type: 'string' },
    progress_analysis: { type: 'string', nullable: true },
  },
  required: ['bf_estimated', 'quality_score', 'quality_feedback', 'visual_observations'],
} as const;

export const SAFETY_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    flagged: { type: 'boolean' },
    reason: {
      type: 'string',
      enum: ['TCA', 'SUICIDE', 'UNDERWEIGHT', 'EXTREME_LOSS'],
      nullable: true,
    },
    message: { type: 'string', nullable: true },
  },
  required: ['flagged', 'reason', 'message'],
} as const;
