import { describe, it, expect } from 'vitest';
import { FormCheckResultSchema } from './schema';

describe('Form Check Result Schema', () => {
  it('should validate complete and correct results', () => {
    const data = {
      exercise: 'Squat',
      score: 8,
      observations: [
        "Trajectoire rectiligne",
        "Bonne profondeur sous la parallèle"
      ],
      recommendations: [
        "Garde la poitrine haute en remontant"
      ],
      safetyAlerts: []
    };

    const parsed = FormCheckResultSchema.safeParse(data);
    expect(parsed.success).toBe(true);
  });

  it('should fail validation when critical fields are missing', () => {
    const data = {
      exercise: '',
      score: 12, // Out of bounds
      observations: ["Unstable spine"],
    };

    const parsed = FormCheckResultSchema.safeParse(data);
    expect(parsed.success).toBe(false);
  });
});
