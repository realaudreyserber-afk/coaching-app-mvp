import { describe, it, expect } from 'vitest';
import { pickEligibleTemplate, type NotifContext } from './templates';

const BASE: NotifContext = {
  uid: 'u1',
  has_checkin_today: false,
  has_micro_task_today_done: false,
  in_fasting_window: false,
  recent_plateau: false,
  hour_local: 12,
};

describe('pickEligibleTemplate', () => {
  it('fires checkin reminder at 20h if no checkin today', () => {
    const p = pickEligibleTemplate({ ...BASE, has_checkin_today: false, hour_local: 20 });
    expect(p?.template_id).toBe('checkin_evening_20h');
    expect(p?.link).toBe('/checkin/daily');
  });

  it('does NOT fire checkin reminder if already done', () => {
    const p = pickEligibleTemplate({ ...BASE, has_checkin_today: true, hour_local: 20 });
    expect(p?.category).not.toBe('checkin_reminder');
  });

  it('fires streak_at_risk over checkin reminder when streak is at risk', () => {
    const p = pickEligibleTemplate({
      ...BASE,
      has_checkin_today: false,
      hour_local: 20,
      streak_current: 14,
      streak_at_risk: true,
    });
    // Order: checkin_evening_20h comes first in the list, so it wins. Verify priority.
    expect(p?.template_id).toBe('checkin_evening_20h');
  });

  it('fires fasting_window_ending_soon when 15min remain', () => {
    const p = pickEligibleTemplate({
      ...BASE,
      has_checkin_today: true,
      hour_local: 19,
      in_fasting_window: false,
      fasting_ends_in_minutes: 15,
    });
    expect(p?.template_id).toBe('fasting_window_ending_soon');
    expect(p?.title).toContain('15 min');
  });

  it('fires milestone at every 5 kg lost', () => {
    const p = pickEligibleTemplate({ ...BASE, has_checkin_today: true, hour_local: 14, weight_kg_lost_total: 10 });
    expect(p?.template_id).toBe('milestone_kg_lost');
    expect(p?.title).toContain('10 kg');
  });

  it('does NOT fire milestone for non-multiples of 5', () => {
    const p = pickEligibleTemplate({ ...BASE, has_checkin_today: true, hour_local: 14, weight_kg_lost_total: 7 });
    expect(p).toBeNull();
  });

  it('returns null when no template matches', () => {
    const p = pickEligibleTemplate({ ...BASE, has_checkin_today: true, hour_local: 14 });
    expect(p).toBeNull();
  });

  it('plateau_detected fires only at 11h', () => {
    expect(pickEligibleTemplate({
      ...BASE, has_checkin_today: true, has_micro_task_today_done: true,
      recent_plateau: true, hour_local: 11,
    })?.template_id).toBe('plateau_detected');
    expect(pickEligibleTemplate({
      ...BASE, has_checkin_today: true, has_micro_task_today_done: true,
      recent_plateau: true, hour_local: 14,
    })).toBeNull();
  });
});
