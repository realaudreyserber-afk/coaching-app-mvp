/**
 * Health metrics aggregator — single source of truth for M7 (wearables)
 * and M8 (TDEE adaptive).
 *
 * Reads from:
 *   - users/{uid}/checkins_daily/{date}      (subjective: weight, sleep, energy, ...)
 *   - users/{uid}/wearable_sync/{date}       (objective: steps, hr, sleep_minutes)
 *   - users/{uid}.profile                     (tdee_theoretical, tdee_adaptive)
 *
 * Returns normalized daily metrics regardless of which sources are configured.
 */

export interface DailyHealthMetrics {
  date: string; // YYYY-MM-DD
  weight_kg?: number;
  steps?: number;
  sleep_minutes?: number;
  heart_rate_avg?: number;
  kcal_burned_active?: number;
  kcal_ingested?: number;
  adherence_nutrition_pct?: number;
  training_done?: boolean;
  energy_score?: number;
  mood_score?: number;
  source_breakdown: {
    has_checkin: boolean;
    has_wearable: boolean;
  };
}

export interface RawCheckinDoc {
  date?: string;
  weight?: number;
  steps?: number;
  sleep_hours?: number;
  sleep_quality?: number;
  energy?: number;
  hunger?: number;
  mood?: number;
  adherence_nutrition?: number;
  training_done?: boolean;
  kcal_ingested?: number;
}

export interface RawWearableSyncDoc {
  source?: string;
  synced_at?: string;
  steps?: number;
  sleep_minutes?: number;
  heart_rate_avg?: number;
  kcal_burned_active?: number;
}

export function aggregateDaily(
  date: string,
  checkin?: RawCheckinDoc | null,
  wearable?: RawWearableSyncDoc | null
): DailyHealthMetrics {
  return {
    date,
    weight_kg: checkin?.weight,
    // wearable takes priority for objective steps if available, else checkin self-report
    steps: wearable?.steps ?? checkin?.steps,
    sleep_minutes:
      wearable?.sleep_minutes ??
      (typeof checkin?.sleep_hours === 'number' ? Math.round(checkin.sleep_hours * 60) : undefined),
    heart_rate_avg: wearable?.heart_rate_avg,
    kcal_burned_active: wearable?.kcal_burned_active,
    kcal_ingested: checkin?.kcal_ingested,
    adherence_nutrition_pct: checkin?.adherence_nutrition,
    training_done: checkin?.training_done,
    energy_score: checkin?.energy,
    mood_score: checkin?.mood,
    source_breakdown: {
      has_checkin: !!checkin,
      has_wearable: !!wearable,
    },
  };
}

/**
 * Compute rolling 7-day average for any numeric field on DailyHealthMetrics.
 * Returns null if fewer than 4 valid datapoints.
 */
export type NumericField =
  | 'weight_kg'
  | 'steps'
  | 'sleep_minutes'
  | 'heart_rate_avg'
  | 'kcal_burned_active'
  | 'kcal_ingested'
  | 'adherence_nutrition_pct'
  | 'energy_score'
  | 'mood_score';

export function rollingAverage(history: DailyHealthMetrics[], field: NumericField): number | null {
  const values: number[] = [];
  for (const h of history) {
    const v = h[field];
    if (typeof v === 'number') values.push(v);
  }
  if (values.length < 4) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Detect a plateau: rolling 7-day weight average flat (within ±0.3 kg)
 * over the last 14 days.
 */
export function detectPlateau(history: DailyHealthMetrics[]): boolean {
  if (history.length < 14) return false;
  const recent = history.slice(-7);
  const older = history.slice(-14, -7);
  const avgRecent = rollingAverage(recent, 'weight_kg');
  const avgOlder = rollingAverage(older, 'weight_kg');
  if (avgRecent === null || avgOlder === null) return false;
  return Math.abs(avgRecent - avgOlder) < 0.3;
}

/**
 * Estimate weekly weight slope (kg/day) for TDEE adaptive calc.
 */
export function weeklyWeightSlope(history: DailyHealthMetrics[]): number | null {
  const weights = history.map((h) => h.weight_kg).filter((w): w is number => typeof w === 'number');
  if (weights.length < 7) return null;
  const xs = weights.map((_, i) => i);
  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = weights.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (weights[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  return den === 0 ? 0 : num / den;
}
