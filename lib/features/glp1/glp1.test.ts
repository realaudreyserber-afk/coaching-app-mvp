import { describe, it, expect } from 'vitest';
import { GLP1MedicationSchema } from './schema';

describe('GLP1 Medication Tracking Schema', () => {
  it('should validate typical GLP-1 configuration', () => {
    const glp1 = {
      active: true,
      molecule: 'semaglutide',
      dose: '0.5mg',
      frequency: 'weekly',
      startDate: '2026-05-01',
      sideEffects: ['nausée', 'fatigue'],
    };

    const parsed = GLP1MedicationSchema.safeParse(glp1);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.molecule).toBe('semaglutide');
      expect(parsed.data.sideEffects).toContain('nausée');
    }
  });

  it('should validate with default values when empty', () => {
    const parsed = GLP1MedicationSchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.active).toBe(false);
      expect(parsed.data.molecule).toBe('semaglutide');
      expect(parsed.data.frequency).toBe('weekly');
      expect(parsed.data.sideEffects).toEqual([]);
    }
  });

  it('should reject invalid molecules', () => {
    const invalid = {
      molecule: 'insulin', // invalid enum
    };
    const parsed = GLP1MedicationSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });
});
