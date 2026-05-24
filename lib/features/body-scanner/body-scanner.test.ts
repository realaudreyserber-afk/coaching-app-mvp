import { describe, it, expect } from 'vitest';
import { BodyScannerAnalysisSchema } from './schema';

describe('Body Scanner Analysis Reports Schema', () => {
  it('should validate complete morpho-analysis vision report', () => {
    const rawReport = {
      bf_pct_estimated: 18.5,
      morphology_notes: [
        'Masse adipeuse répartie uniformément.',
        'Bonne définition des deltoïdes et pectoraux.'
      ],
      changes_vs_previous: [
        'Réduction de 1.2% du taux de masse grasse.',
        'Meilleure posture avec tête redressée.'
      ],
      asymmetries: [
        'Épaule droite légèrement affaissée.'
      ],
      posture_observations: [
        'Léger anterior pelvic tilt.'
      ]
    };

    const parsed = BodyScannerAnalysisSchema.safeParse(rawReport);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.bf_pct_estimated).toBe(18.5);
      expect(parsed.data.changes_vs_previous).toContain('Meilleure posture avec tête redressée.');
    }
  });

  it('should reject reports with missing mandatory arrays', () => {
    const invalidReport = {
      bf_pct_estimated: 20.0,
      // morphology_notes and posture_observations are missing
    };

    const parsed = BodyScannerAnalysisSchema.safeParse(invalidReport);
    expect(parsed.success).toBe(false);
  });
});
