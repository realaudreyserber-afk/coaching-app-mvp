import { describe, it, expect } from 'vitest';
import { computeForme } from './forme';

describe('progress / computeForme', () => {
  it('aucun signal -> score null', () => {
    const f = computeForme({});
    expect(f.score).toBeNull();
    expect(f.label).toMatch(/insuffisantes/i);
  });

  it('excellente forme (tous signaux au vert)', () => {
    const f = computeForme({
      sleep: { avg_hours_7day: 8, avg_quality_7day: 9, short_nights_7day: 0 },
      hrv: { is_chronic_drift: false, baseline_drift_pct: 2, avg_hrv_7day: 65 },
      hydration: { days_target_hit_7day: 7 },
      energyAvg: 9,
    });
    expect(f.score).toBeGreaterThanOrEqual(85);
    expect(f.label).toBe('Excellente forme');
    expect(f.drivers.every((d) => d.ok)).toBe(true);
  });

  it('récup prioritaire (sommeil court + HRV fatigue)', () => {
    const f = computeForme({
      sleep: { avg_hours_7day: 5, avg_quality_7day: 4, short_nights_7day: 4 },
      hrv: { is_chronic_drift: true, baseline_drift_pct: -18, avg_hrv_7day: 40 },
      hydration: { days_target_hit_7day: 1 },
      energyAvg: 3,
    });
    expect(f.score).toBeLessThan(40);
    expect(f.label).toBe('Récup prioritaire');
  });

  it('renormalise sur les signaux présents (sommeil seul)', () => {
    const f = computeForme({ sleep: { avg_hours_7day: 7.5, avg_quality_7day: 8, short_nights_7day: 0 } });
    expect(f.score).not.toBeNull();
    expect(f.drivers).toHaveLength(1);
    expect(f.drivers[0].label).toMatch(/Sommeil/);
  });
});
