/**
 * Gemini responseSchema for M1 photo-meal Vision analysis.
 * Mirrors PhotoMealAnalysisSchema (Zod) in OpenAPI 3.0 subset format.
 */

export const PHOTO_MEAL_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          qty_estimated_g: { type: 'number' },
          kcal: { type: 'number' },
          p: { type: 'number' },
          c: { type: 'number' },
          f: { type: 'number' },
          confidence: { type: 'number' },
        },
        required: ['name', 'qty_estimated_g', 'kcal', 'p', 'c', 'f', 'confidence'],
      },
    },
    total: {
      type: 'object',
      properties: {
        kcal: { type: 'number' },
        p: { type: 'number' },
        c: { type: 'number' },
        f: { type: 'number' },
      },
      required: ['kcal', 'p', 'c', 'f'],
    },
  },
  required: ['items', 'total'],
} as const;
