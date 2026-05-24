import { describe, it, expect } from 'vitest';
import { PhotoMealAnalysisSchema } from './schema';

describe('Photo to Meal Nutrition Validation', () => {
  it('should validate complete PhotoMealAnalysis JSON schema', () => {
    const rawAnalysis = {
      items: [
        {
          name: 'Blanc de poulet cuit',
          qty_estimated_g: 150,
          kcal: 220,
          p: 46.5,
          c: 0,
          f: 3.0,
          confidence: 0.95,
        },
        {
          name: 'Riz basmati cuit',
          qty_estimated_g: 200,
          kcal: 260,
          p: 5.0,
          c: 56.0,
          f: 0.4,
          confidence: 0.9,
        },
      ],
      total: {
        kcal: 480,
        p: 51.5,
        c: 56.0,
        f: 3.4,
      },
    };

    const parsed = PhotoMealAnalysisSchema.safeParse(rawAnalysis);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.items[0].qty_estimated_g).toBe(150);
      expect(parsed.data.total.kcal).toBe(480);
    }
  });

  it('should reject invalid schemas (missing total or incorrect types)', () => {
    const invalidAnalysis = {
      items: [
        {
          name: 'Poulet',
          qty_estimated_g: '150g', // should be number
          kcal: 200,
        },
      ],
    };

    const parsed = PhotoMealAnalysisSchema.safeParse(invalidAnalysis);
    expect(parsed.success).toBe(false);
  });
});
