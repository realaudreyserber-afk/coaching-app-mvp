import { describe, it, expect } from 'vitest';
import { calculateStreak } from './streak-service';

describe('Streak Calculation Service', () => {
  it('should return 0 streak for empty dates', () => {
    const { currentStreak, longestStreak } = calculateStreak([], '2026-05-24');
    expect(currentStreak).toBe(0);
    expect(longestStreak).toBe(0);
  });

  it('should calculate streak of 1 when only today is checked in', () => {
    const dates = ['2026-05-24'];
    const { currentStreak, longestStreak } = calculateStreak(dates, '2026-05-24');
    expect(currentStreak).toBe(1);
    expect(longestStreak).toBe(1);
  });

  it('should calculate streak of 1 when only yesterday is checked in', () => {
    const dates = ['2026-05-23'];
    const { currentStreak, longestStreak } = calculateStreak(dates, '2026-05-24');
    expect(currentStreak).toBe(1);
    expect(longestStreak).toBe(1);
  });

  it('should calculate streak of 3 for consecutive days including today', () => {
    const dates = ['2026-05-24', '2026-05-23', '2026-05-22'];
    const { currentStreak, longestStreak } = calculateStreak(dates, '2026-05-24');
    expect(currentStreak).toBe(3);
    expect(longestStreak).toBe(3);
  });

  it('should calculate longest streak from past history', () => {
    const dates = [
      // Past streak of 5
      '2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05',
      // Gap
      // Current streak of 2
      '2026-05-23', '2026-05-24'
    ];
    const { currentStreak, longestStreak } = calculateStreak(dates, '2026-05-24');
    expect(currentStreak).toBe(2);
    expect(longestStreak).toBe(5);
  });

  it('should return current streak 0 if gap is larger than 1 day', () => {
    const dates = ['2026-05-20', '2026-05-21', '2026-05-22'];
    // Today is 2026-05-24, yesterday was 2026-05-23 (missing). Current streak is broken.
    const { currentStreak, longestStreak } = calculateStreak(dates, '2026-05-24');
    expect(currentStreak).toBe(0);
    expect(longestStreak).toBe(3);
  });
});
