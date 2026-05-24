import { describe, it, expect } from 'vitest';
import { BloodworkAnalysisSchema } from './schema';

describe('Bloodwork Analysis Schema', () => {
  it('should validate complete medical lab extractions', () => {
    const data = {
      date: '2026-05-15',
      markers: [
        { name: 'Ferritine', value: 85, unit: 'µg/L', referenceRange: '30 - 400', status: 'normal' },
        { name: 'Glycémie', value: 1.12, unit: 'g/L', referenceRange: '0.70 - 1.10', status: 'high' }
      ],
      summary: "Glycémie légèrement élevée.",
      recommendations: ["Limite les sucres raffinés."]
    };

    const parsed = BloodworkAnalysisSchema.safeParse(data);
    expect(parsed.success).toBe(true);
  });

  it('should reject invalid dates', () => {
    const data = {
      date: '15/05/2026', // Incorrect format
      markers: [],
      summary: "Vide",
      recommendations: []
    };

    const parsed = BloodworkAnalysisSchema.safeParse(data);
    expect(parsed.success).toBe(false);
  });
});
