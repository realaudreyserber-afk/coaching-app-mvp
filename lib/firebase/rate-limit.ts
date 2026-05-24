import { adminDb } from './admin';

/**
 * Per-user rate limiter using Firestore atomic counters.
 * O(1) document size: 4 fields total, rotated when the window key changes.
 * No accumulation over time.
 */

export interface RateLimitConfig {
  perMinute?: number;
  perHour?: number;
  scope: string;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: { minute: number; hour: number };
  retryAfterSec?: number;
}

interface RateLimitDoc {
  minute_key?: string;
  minute_count?: number;
  hour_key?: string;
  hour_count?: number;
  last_request_at?: string;
}

function buildKeys(now: Date): { minuteKey: string; hourKey: string } {
  const y = now.getUTCFullYear();
  const mo = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const h = String(now.getUTCHours()).padStart(2, '0');
  const m = String(now.getUTCMinutes()).padStart(2, '0');
  return { minuteKey: `${y}${mo}${d}${h}${m}`, hourKey: `${y}${mo}${d}${h}` };
}

export async function checkRateLimit(uid: string, cfg: RateLimitConfig): Promise<RateLimitResult> {
  const now = new Date();
  const { minuteKey, hourKey } = buildKeys(now);

  const ref = adminDb
    .collection('users').doc(uid)
    .collection('rate_limits').doc(cfg.scope);

  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data: RateLimitDoc = snap.exists ? (snap.data() ?? {}) : {};

    const sameMinute = data.minute_key === minuteKey;
    const sameHour = data.hour_key === hourKey;
    const minuteCount = sameMinute ? (data.minute_count ?? 0) : 0;
    const hourCount = sameHour ? (data.hour_count ?? 0) : 0;

    const perMin = cfg.perMinute ?? Infinity;
    const perHour = cfg.perHour ?? Infinity;

    if (minuteCount >= perMin) {
      return {
        ok: false,
        remaining: { minute: 0, hour: Math.max(0, perHour - hourCount) },
        retryAfterSec: 60 - now.getUTCSeconds(),
      };
    }
    if (hourCount >= perHour) {
      return {
        ok: false,
        remaining: { minute: Math.max(0, perMin - minuteCount), hour: 0 },
        retryAfterSec: 3600 - (now.getUTCMinutes() * 60 + now.getUTCSeconds()),
      };
    }

    const next: RateLimitDoc = {
      minute_key: minuteKey,
      minute_count: minuteCount + 1,
      hour_key: hourKey,
      hour_count: hourCount + 1,
      last_request_at: now.toISOString(),
    };

    if (snap.exists) tx.update(ref, next as Record<string, unknown>);
    else tx.set(ref, next);

    return {
      ok: true,
      remaining: {
        minute: perMin - (minuteCount + 1),
        hour: perHour - (hourCount + 1),
      },
    };
  });
}
