import { describe, it, expect } from 'vitest';
import { FastingProtocolSchema } from './schema';
import { getFastingState } from './fasting-util';

describe('Fasting Protocol Schema & State Utility', () => {
  it('should validate typical fasting configurations', () => {
    const protocol = {
      type: '16:8',
      eating_window_start: '12:00',
      eating_window_end: '20:00',
      days_active: [0, 1, 2, 3, 4, 5, 6],
      active: true,
    };

    const parsed = FastingProtocolSchema.safeParse(protocol);
    expect(parsed.success).toBe(true);
  });

  it('should calculate active eating window correctly (daytime)', () => {
    const protocol = {
      type: '16:8' as const,
      eating_window_start: '12:00',
      eating_window_end: '20:00',
      days_active: [0, 1, 2, 3, 4, 5, 6],
      active: true,
    };

    // Current time: 15:30 (inside eating window)
    const testDate = new Date(2026, 4, 24, 15, 30, 0); // May 24, 2026 (Sunday)
    const state = getFastingState(protocol, testDate);

    expect(state.isEatingWindow).toBe(true);
    // Time remaining should be 20:00 - 15:30 = 4.5 hours = 16,200,000 ms
    expect(state.timeRemainingMs).toBe(4.5 * 60 * 60 * 1000);
    expect(state.label).toContain("Fenêtre d'alimentation active. Fin dans 4h 30m.");
  });

  it('should calculate fasting state correctly (daytime fasting)', () => {
    const protocol = {
      type: '16:8' as const,
      eating_window_start: '12:00',
      eating_window_end: '20:00',
      days_active: [0, 1, 2, 3, 4, 5, 6],
      active: true,
    };

    // Current time: 08:30 (outside eating window, morning)
    const testDate = new Date(2026, 4, 24, 8, 30, 0); 
    const state = getFastingState(protocol, testDate);

    expect(state.isEatingWindow).toBe(false);
    // Time remaining until 12:00 = 3.5 hours = 12,600,000 ms
    expect(state.timeRemainingMs).toBe(3.5 * 60 * 60 * 1000);
    expect(state.label).toContain("Période de jeûne active. Fin dans 3h 30m.");
  });

  it('should handle windows spanning across midnight (eating during night)', () => {
    const protocol = {
      type: '16:8' as const,
      eating_window_start: '20:00',
      eating_window_end: '04:00',
      days_active: [0, 1, 2, 3, 4, 5, 6],
      active: true,
    };

    // Current time: 22:00 (eating window active)
    const testDate1 = new Date(2026, 4, 24, 22, 0, 0);
    const state1 = getFastingState(protocol, testDate1);
    expect(state1.isEatingWindow).toBe(true);
    // 6 hours left until 04:00 tomorrow
    expect(state1.timeRemainingMs).toBe(6 * 60 * 60 * 1000);

    // Current time: 02:00 (eating window active, post-midnight)
    const testDate2 = new Date(2026, 4, 25, 2, 0, 0);
    const state2 = getFastingState(protocol, testDate2);
    expect(state2.isEatingWindow).toBe(true);
    // 2 hours left until 04:00
    expect(state2.timeRemainingMs).toBe(2 * 60 * 60 * 1000);

    // Current time: 10:00 (fasting window active)
    const testDate3 = new Date(2026, 4, 25, 10, 0, 0);
    const state3 = getFastingState(protocol, testDate3);
    expect(state3.isEatingWindow).toBe(false);
    // 10 hours left until 20:00
    expect(state3.timeRemainingMs).toBe(10 * 60 * 60 * 1000);
  });
});
