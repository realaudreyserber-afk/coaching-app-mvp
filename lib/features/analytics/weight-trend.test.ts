import { describe, it, expect } from 'vitest';
import { computeWeightTrend } from './weight-trend';

describe('computeWeightTrend', () => {
  it('vide -> aucun trend', () => {
    const t = computeWeightTrend([]);
    expect(t.n_points).toBe(0);
    expect(t.kg_per_week).toBeNull();
    expect(t.plateau).toBe(false);
    expect(t.weekly_avg).toEqual([]);
  });

  it('un seul point -> span 0, kg/sem null', () => {
    const t = computeWeightTrend([{ date: '2026-01-01', weight: 80 }]);
    expect(t.n_points).toBe(1);
    expect(t.span_days).toBe(0);
    expect(t.kg_per_week).toBeNull();
  });

  it('perte régulière sur 28j -> kg/sem négatif, pas de plateau', () => {
    const t = computeWeightTrend([
      { date: '2026-01-01', weight: 80 },
      { date: '2026-01-08', weight: 79.5 },
      { date: '2026-01-15', weight: 79 },
      { date: '2026-01-22', weight: 78.5 },
      { date: '2026-01-29', weight: 78 },
    ]);
    expect(t.span_days).toBe(28);
    expect(t.kg_per_week).toBeCloseTo(-0.5, 1);
    expect(t.plateau).toBe(false);
    expect(t.weekly_avg.length).toBeGreaterThanOrEqual(4);
  });

  it('poids stable sur 28j -> plateau détecté (≥21j ET |kg/sem|<0.2)', () => {
    const t = computeWeightTrend([
      { date: '2026-01-01', weight: 80 },
      { date: '2026-01-10', weight: 80.05 },
      { date: '2026-01-20', weight: 79.98 },
      { date: '2026-01-29', weight: 79.95 },
    ]);
    expect(t.plateau).toBe(true);
    expect(t.plateau_weeks).toBe(4);
  });

  it('fenêtre courte (<21j) ne déclenche pas de plateau même si stable', () => {
    const t = computeWeightTrend([
      { date: '2026-01-01', weight: 80 },
      { date: '2026-01-10', weight: 80 },
    ]);
    expect(t.span_days).toBe(9);
    expect(t.plateau).toBe(false);
  });

  it('ignore les poids non-finis / manquants', () => {
    const t = computeWeightTrend([
      { date: '2026-01-01', weight: 80 },
      { date: '2026-01-08', weight: null },
      { date: '2026-01-15', weight: NaN as unknown as number },
      { date: '2026-01-29', weight: 78 },
    ]);
    expect(t.n_points).toBe(2);
    expect(t.span_days).toBe(28);
  });
});
