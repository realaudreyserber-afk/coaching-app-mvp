import { describe, it, expect } from 'vitest';
import { aggregateDaily, rollingAverage, detectPlateau, weeklyWeightSlope, type DailyHealthMetrics } from './aggregator';

describe('aggregateDaily', () => {
  it('wearable steps override checkin steps', () => {
    const out = aggregateDaily(
      '2026-05-24',
      { steps: 5000, weight: 80 },
      { steps: 8420 }
    );
    expect(out.steps).toBe(8420);
    expect(out.weight_kg).toBe(80);
    expect(out.source_breakdown.has_wearable).toBe(true);
    expect(out.source_breakdown.has_checkin).toBe(true);
  });

  it('falls back to checkin steps when no wearable', () => {
    const out = aggregateDaily('2026-05-24', { steps: 5000 }, null);
    expect(out.steps).toBe(5000);
    expect(out.source_breakdown.has_wearable).toBe(false);
  });

  it('converts sleep_hours to sleep_minutes', () => {
    const out = aggregateDaily('2026-05-24', { sleep_hours: 7.5 }, null);
    expect(out.sleep_minutes).toBe(450);
  });

  it('handles empty inputs gracefully', () => {
    const out = aggregateDaily('2026-05-24', null, null);
    expect(out.date).toBe('2026-05-24');
    expect(out.weight_kg).toBeUndefined();
    expect(out.source_breakdown.has_checkin).toBe(false);
  });
});

function makeHistory(weights: number[]): DailyHealthMetrics[] {
  return weights.map((w, i) => ({
    date: `2026-05-${String(i + 1).padStart(2, '0')}`,
    weight_kg: w,
    source_breakdown: { has_checkin: true, has_wearable: false },
  }));
}

describe('rollingAverage', () => {
  it('returns null when fewer than 4 valid datapoints', () => {
    expect(rollingAverage(makeHistory([80, 80, 80]), 'weight_kg')).toBe(null);
  });

  it('averages numeric field', () => {
    const out = rollingAverage(makeHistory([80, 81, 82, 83]), 'weight_kg');
    expect(out).toBeCloseTo(81.5);
  });
});

describe('detectPlateau', () => {
  it('returns true when 14-day average is flat (<0.3kg diff)', () => {
    const history = makeHistory([80.1, 80.0, 80.2, 80.0, 80.1, 80.0, 80.1, 80.0, 80.1, 80.0, 80.0, 80.1, 80.0, 80.0]);
    expect(detectPlateau(history)).toBe(true);
  });

  it('returns false when weight is dropping', () => {
    const history = makeHistory([85, 84.5, 84, 83.5, 83, 82.5, 82, 81.5, 81, 80.5, 80, 79.5, 79, 78.5]);
    expect(detectPlateau(history)).toBe(false);
  });

  it('returns false when history is too short', () => {
    expect(detectPlateau(makeHistory([80, 80, 80]))).toBe(false);
  });
});

describe('weeklyWeightSlope', () => {
  it('returns negative slope for losing weight', () => {
    const slope = weeklyWeightSlope(makeHistory([85, 84.5, 84, 83.5, 83, 82.5, 82]));
    expect(slope).toBeLessThan(0);
  });

  it('returns positive slope for gaining', () => {
    const slope = weeklyWeightSlope(makeHistory([80, 80.2, 80.4, 80.6, 80.8, 81, 81.2]));
    expect(slope).toBeGreaterThan(0);
  });

  it('returns null when history < 7 days', () => {
    expect(weeklyWeightSlope(makeHistory([80, 80, 80]))).toBe(null);
  });
});
