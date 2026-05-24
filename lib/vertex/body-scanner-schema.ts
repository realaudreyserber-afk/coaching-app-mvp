/**
 * Gemini responseSchema for M11 body scanner Vision analysis.
 * Mirrors BodyScannerAnalysisSchema (Zod) in OpenAPI 3.0 subset.
 */

export const BODY_SCANNER_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    bf_pct_estimated: { type: 'number' },
    morphology_notes: {
      type: 'array',
      items: { type: 'string' },
    },
    posture_observations: {
      type: 'array',
      items: { type: 'string' },
    },
    asymmetries: {
      type: 'array',
      items: { type: 'string' },
    },
    changes_vs_previous: {
      type: 'array',
      items: { type: 'string' },
    },
    overall_narrative: { type: 'string' },
  },
  required: ['bf_pct_estimated', 'morphology_notes', 'overall_narrative'],
} as const;
