/**
 * Server-side fetcher for the Wave 5A coach context enrichments.
 *
 * Schema corrections after Wave 5F code review :
 * - food_logs : champ `logged_at`, totaux dans `totals.{kcal,p,c,f}`, name dans `items[0].name`
 * - form_checks : tri par `analyzed_at`, feedback dérivé de `analysis.recommendations[0]`
 * - body_scans : champ `bf_pct_estimated` (pas `bf_pct`), pas de `muscle_mass_kg` (placeholder)
 * - wearables : collection `wearable_sync` (legacy camelCase, à migrer Wave 6)
 *
 * Single point of entry to load all the optional context blocks the coach
 * needs. Each fetch wrapped try/catch + logged warn — un getter cassé ne
 * doit jamais faire échouer la requête coach.
 *
 * Used by :
 *   - /api/ai/coach
 *   - /api/ai/coach-session-debrief
 *   - /api/ai/coach-progress-analysis (future)
 */

import 'server-only';
import { adminDb } from '@/lib/firebase/admin';
import type {
  BuildContextInput,
  LastSessionSummary,
  TodayFoodLogsSummary,
  RecentFormCheck,
  BodyScanRecent,
  WearablesToday,
  StreakState,
  SubscriptionContext,
  Checkin7DayHistory,
  TdeeHistoryEntry,
  CoachPatchSummary,
} from './context-builder';

/**
 * Returns the YYYY-MM-DD slug in the user's local timezone.
 *
 * Post-Wave-6 review fix : was using UTC, which broke the coach context for
 * any user east of UTC+0 after their local 23:00 (UTC rolls to the next day
 * but their food_logs / wearables are bucketed local-time). For an FR user
 * at 23:30 local (UTC+1), the coach used to report "0 food logs today"
 * because the UTC day had already advanced.
 *
 * `Intl.DateTimeFormat('en-CA', { timeZone })` returns "YYYY-MM-DD" reliably.
 */
function todayIsoYmd(timezone?: string): string {
  const tz = timezone || 'Europe/Paris';
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    // Invalid tz string — fall back to server UTC
    return new Date().toISOString().split('T')[0];
  }
}

/**
 * Returns the Date object representing "start of today" in the given TZ,
 * expressed as a UTC Date (for Firestore range queries on ISO timestamps).
 */
function startOfTodayInTz(timezone?: string): Date {
  const ymd = todayIsoYmd(timezone);
  // Parse "YYYY-MM-DD" as midnight in the user's TZ, then convert to UTC.
  // Trick: get the TZ offset by formatting a fixed instant and reading
  // the resulting hour offset.
  const tz = timezone || 'Europe/Paris';
  const [y, m, d] = ymd.split('-').map((s) => parseInt(s, 10));
  // Approximate via Date constructor at midnight local + adjust for TZ offset
  // computed from the difference between UTC time and TZ-formatted time.
  const utcMidnightOfYmd = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const parts = formatter.formatToParts(utcMidnightOfYmd);
  const tzHour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
  const tzMinute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
  // If tzHour is 1, the UTC midnight is 1am in TZ → TZ midnight was 1h earlier in UTC
  const offsetMs = (tzHour * 60 + tzMinute) * 60 * 1000;
  return new Date(utcMidnightOfYmd.getTime() - offsetMs);
}

interface FoodLogDoc {
  logged_at?: string;
  totals?: { kcal?: number; p?: number; c?: number; f?: number };
  items?: Array<{ name?: string; brand?: string; kcal?: number }>;
  notes?: string;
  source?: string;
}

/**
 * Fetch today's food_logs (per canonical schema lib/features/food-logs/schema.ts)
 * and aggregate kcal/macros + first-item name samples for the prompt block.
 */
async function fetchTodayFoodLogs(
  uid: string,
  kcalTarget?: number,
  timezone?: string,
): Promise<TodayFoodLogsSummary | undefined> {
  try {
    const startOfToday = startOfTodayInTz(timezone);
    const snap = await adminDb
      .collection('users')
      .doc(uid)
      .collection('food_logs')
      .where('logged_at', '>=', startOfToday.toISOString())
      .orderBy('logged_at', 'desc')
      .limit(30)
      .get();
    if (snap.empty) return undefined;

    let kcalTotal = 0;
    const macros = { p: 0, c: 0, f: 0 };
    const meals: Array<{ name: string; kcal: number }> = [];
    snap.forEach((d) => {
      const data = d.data() as FoodLogDoc;
      const t = data.totals;
      const logKcal = t?.kcal ?? 0;
      kcalTotal += logKcal;
      macros.p += t?.p ?? 0;
      macros.c += t?.c ?? 0;
      macros.f += t?.f ?? 0;
      const firstItem = data.items?.[0];
      meals.push({
        name: firstItem?.name ?? data.notes ?? 'aliment',
        kcal: Math.round(logKcal),
      });
    });

    return {
      date: todayIsoYmd(timezone),
      count: snap.size,
      kcal_total: Math.round(kcalTotal),
      macros_total: {
        p: Math.round(macros.p),
        c: Math.round(macros.c),
        f: Math.round(macros.f),
      },
      kcal_target: kcalTarget,
      meals_sample: meals.slice(0, 5),
    };
  } catch (e) {
    console.warn('[context-fetcher] food_logs fetch failed:', e);
    return undefined;
  }
}

interface FormCheckDoc {
  analyzed_at?: string;
  exercise?: string;
  exercise_name?: string;
  analysis?: {
    recommendations?: string[];
    observations?: string[];
    score?: number;
    safetyAlerts?: string[];
    safety_alerts?: string[];
  };
}

/**
 * Fetch the 3 most recent form-check video analyses.
 * Writer schema (`app/api/exercise/form-check/route.ts`):
 *   - `analyzed_at` (ISO)
 *   - `exercise` (input from client)
 *   - `analysis: { recommendations, observations, score, safetyAlerts }`
 */
async function fetchRecentFormChecks(uid: string): Promise<RecentFormCheck[] | undefined> {
  try {
    const snap = await adminDb
      .collection('users')
      .doc(uid)
      .collection('form_checks')
      .orderBy('analyzed_at', 'desc')
      .limit(3)
      .get();
    if (snap.empty) return undefined;
    return snap.docs.map((d) => {
      const data = d.data() as FormCheckDoc;
      // Prefer the first recommendation as the actionable feedback; fall back
      // to the first observation if no reco available.
      const reco = data.analysis?.recommendations?.[0];
      const obs = data.analysis?.observations?.[0];
      const safety = data.analysis?.safetyAlerts?.[0] ?? data.analysis?.safety_alerts?.[0];
      return {
        exercise_name: data.exercise_name ?? data.exercise ?? 'exercice',
        date: (data.analyzed_at ?? '').slice(0, 10),
        feedback_short: (reco ?? obs ?? safety ?? '(pas de retour)').slice(0, 200),
      };
    });
  } catch (e) {
    console.warn('[context-fetcher] form_checks fetch failed:', e);
    return undefined;
  }
}

interface BodyScanDoc {
  bf_pct_estimated?: number;
  morphology_notes?: string[];
  posture_observations?: string[];
  created_at?: string;
}

/**
 * Fetch the latest body scan + diff vs the previous one (Wave 2 feature).
 * Writer schema (`app/api/scanner/analyze/route.ts`):
 *   - `bf_pct_estimated` (not `bf_pct`)
 *   - `morphology_notes`, `posture_observations`
 *   - `created_at` ISO
 * The Wave 5A muscle_mass_kg field is left undefined — the scanner doesn't
 * estimate it. We keep the type slot for when the scan grows that capability.
 */
async function fetchBodyScanRecent(uid: string): Promise<BodyScanRecent | undefined> {
  try {
    const snap = await adminDb
      .collection('users')
      .doc(uid)
      .collection('body_scans')
      .orderBy('created_at', 'desc')
      .limit(2)
      .get();
    if (snap.empty) return undefined;
    const docs = snap.docs.map((d) => d.data() as BodyScanDoc);
    const latest = docs[0];
    const previous = docs[1];

    const recent: BodyScanRecent = {
      date: (latest.created_at ?? '').slice(0, 10),
      bf_pct: latest.bf_pct_estimated,
      muscle_mass_kg: undefined, // scanner doesn't estimate this yet
    };

    if (previous) {
      const latestTs = new Date(latest.created_at ?? '').getTime();
      const prevTs = new Date(previous.created_at ?? '').getTime();
      const daysBetween = Math.round((latestTs - prevTs) / (24 * 3600 * 1000));
      recent.diff_vs_previous = {
        bf_pct_delta:
          typeof latest.bf_pct_estimated === 'number' &&
          typeof previous.bf_pct_estimated === 'number'
            ? Math.round((latest.bf_pct_estimated - previous.bf_pct_estimated) * 10) / 10
            : undefined,
        muscle_mass_kg_delta: undefined,
        days_between: daysBetween,
      };
    }

    return recent;
  } catch (e) {
    console.warn('[context-fetcher] body_scans fetch failed:', e);
    return undefined;
  }
}

interface WearableSyncDoc {
  steps?: number;
  caloriesBurned?: number; // legacy camelCase from sync-wearables route
  active_calories_kcal?: number; // future snake_case (not yet written)
  hr_resting_bpm?: number;
  source?: string;
  syncedAt?: string;
}

/**
 * Fetch today's wearable summary (Google Fit / Apple Health).
 * Writer schema (`app/api/user/sync-wearables/route.ts`):
 *   - collection : `users/{uid}/wearable_sync/{YYYY-MM-DD}`
 *   - fields : `steps`, `caloriesBurned` (camelCase legacy)
 *
 * TODO Wave 6 : migrate writer to snake_case `active_calories_kcal`.
 */
async function fetchWearablesToday(uid: string, timezone?: string): Promise<WearablesToday | undefined> {
  try {
    const today = todayIsoYmd(timezone);
    const snap = await adminDb
      .collection('users')
      .doc(uid)
      .collection('wearable_sync')
      .doc(today)
      .get();
    if (!snap.exists) return undefined;
    const data = (snap.data() ?? {}) as WearableSyncDoc;
    return {
      date: today,
      steps: data.steps,
      // Support both camelCase legacy and future snake_case
      active_calories_kcal: data.active_calories_kcal ?? data.caloriesBurned,
      hr_resting_bpm: data.hr_resting_bpm,
      source: data.source ?? 'google_fit',
    };
  } catch (e) {
    console.warn('[context-fetcher] wearables fetch failed:', e);
    return undefined;
  }
}

// ────────────────────────────────────────────────────────────────
// Wave 13E — historique checkins 7j + TDEE adaptatif + patches récents
// ────────────────────────────────────────────────────────────────

interface CheckinDailyDoc {
  // Shape tolérant : différents writers ont utilisé des conventions
  // légèrement différentes (weight vs weight_kg, etc.). On accepte tout.
  weight?: number;
  weight_kg?: number;
  sleep_hours?: number;
  sleep?: number;
  energy?: number;
  energy_1_10?: number;
  mood?: number;
  mood_1_10?: number;
  hunger?: number;
  hunger_1_10?: number;
  adherence_nutrition?: number;
  adherence_pct?: number;
  session_done?: boolean;
  workout_done?: boolean;
  notes?: string;
  notes_user?: string;
  user_notes?: string;
  created_at?: string;
  date?: string;
}

async function fetchCheckin7DayHistory(
  uid: string,
  timezone?: string,
): Promise<Checkin7DayHistory | undefined> {
  try {
    const sevenDaysAgo = new Date(startOfTodayInTz(timezone).getTime() - 7 * 24 * 3600 * 1000);
    const snap = await adminDb
      .collection('users').doc(uid)
      .collection('checkins_daily')
      .where('created_at', '>=', sevenDaysAgo.toISOString())
      .orderBy('created_at', 'asc')
      .limit(7)
      .get();
    if (snap.empty) return undefined;

    const docs = snap.docs.map((d) => d.data() as CheckinDailyDoc);

    // Weight trend
    const weights = docs
      .map((d) => d.weight ?? d.weight_kg)
      .filter((w): w is number => typeof w === 'number' && w > 0);
    let weightTrend: Checkin7DayHistory['weight_trend'];
    if (weights.length >= 2) {
      const first = weights[0];
      const last = weights[weights.length - 1];
      const delta = last - first;
      weightTrend = {
        earliest_weight_kg: Math.round(first * 100) / 100,
        latest_weight_kg: Math.round(last * 100) / 100,
        delta_kg: Math.round(delta * 100) / 100,
        delta_pct_of_latest:
          last > 0 ? Math.round((delta / last) * 1000) / 10 : undefined,
      };
    } else if (weights.length === 1) {
      weightTrend = { latest_weight_kg: Math.round(weights[0] * 100) / 100 };
    }

    // Averages
    const avg = (vals: number[]) =>
      vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100 : undefined;
    const sleeps = docs
      .map((d) => d.sleep_hours ?? d.sleep)
      .filter((v): v is number => typeof v === 'number');
    const energies = docs
      .map((d) => d.energy ?? d.energy_1_10)
      .filter((v): v is number => typeof v === 'number');
    const moods = docs
      .map((d) => d.mood ?? d.mood_1_10)
      .filter((v): v is number => typeof v === 'number');
    const hungers = docs
      .map((d) => d.hunger ?? d.hunger_1_10)
      .filter((v): v is number => typeof v === 'number');
    const adherences = docs
      .map((d) => d.adherence_nutrition ?? d.adherence_pct)
      .filter((v): v is number => typeof v === 'number');

    const averages = {
      sleep_hours: avg(sleeps),
      energy_1_10: avg(energies),
      mood_1_10: avg(moods),
      hunger_1_10: avg(hungers),
      adherence_pct: avg(adherences),
    };

    const sessionsDone = docs.filter(
      (d) => d.session_done === true || d.workout_done === true,
    ).length;

    const recentNotes = docs
      .map((d) => d.notes ?? d.notes_user ?? d.user_notes)
      .filter((n): n is string => typeof n === 'string' && n.trim().length > 0)
      .slice(-3)
      .map((n) => n.slice(0, 200));

    return {
      count: docs.length,
      weight_trend: weightTrend,
      averages,
      sessions_done: sessionsDone,
      recent_notes: recentNotes.length ? recentNotes : undefined,
    };
  } catch (e) {
    console.warn('[context-fetcher] checkin_7day_history fetch failed:', e);
    return undefined;
  }
}

interface TdeeHistoryDoc {
  week_key?: string;
  tdee_kcal?: number;
  tdee?: number;
  mean_weight_kg?: number;
  mean_weight?: number;
  delta_weight_kg?: number;
  delta_weight?: number;
  created_at?: string;
}

async function fetchTdeeHistory(
  uid: string,
  limit = 4,
): Promise<TdeeHistoryEntry[] | undefined> {
  try {
    const snap = await adminDb
      .collection('users').doc(uid)
      .collection('tdee_history')
      .orderBy('created_at', 'desc')
      .limit(limit)
      .get();
    if (snap.empty) return undefined;
    return snap.docs.map((d) => {
      const data = d.data() as TdeeHistoryDoc;
      return {
        week_key: data.week_key ?? d.id,
        tdee_kcal: data.tdee_kcal ?? data.tdee ?? 0,
        mean_weight_kg: data.mean_weight_kg ?? data.mean_weight,
        delta_weight_kg: data.delta_weight_kg ?? data.delta_weight,
        created_at: data.created_at,
      };
    });
  } catch (e) {
    console.warn('[context-fetcher] tdee_history fetch failed:', e);
    return undefined;
  }
}

interface CoachPatchDoc {
  patch?: Record<string, unknown>;
  patch_applied?: Record<string, unknown>;
  accepted?: string[];
  fields_changed?: string[];
  reason?: string;
  reason_short?: string;
  created_at?: string;
  applied_at?: string;
  archived_at?: string;
}

async function fetchRecentCoachPatches(
  uid: string,
  limit = 5,
): Promise<CoachPatchSummary[] | undefined> {
  try {
    const snap = await adminDb
      .collection('users').doc(uid)
      .collection('coach_patches')
      .orderBy('created_at', 'desc')
      .limit(limit)
      .get();
    if (snap.empty) return undefined;
    return snap.docs.map((d) => {
      const data = d.data() as CoachPatchDoc;
      const dateStr =
        data.created_at ?? data.applied_at ?? data.archived_at ?? '';
      // Détecter les fields modifiés : priorité fields_changed > accepted >
      // keys de patch_applied > keys de patch.
      let fields: string[] = [];
      if (Array.isArray(data.fields_changed)) fields = data.fields_changed;
      else if (Array.isArray(data.accepted)) fields = data.accepted;
      else if (data.patch_applied && typeof data.patch_applied === 'object')
        fields = Object.keys(data.patch_applied);
      else if (data.patch && typeof data.patch === 'object')
        fields = Object.keys(data.patch);
      return {
        date: dateStr.slice(0, 10),
        fields_changed: fields,
        reason: data.reason ?? data.reason_short,
      };
    });
  } catch (e) {
    console.warn('[context-fetcher] coach_patches fetch failed:', e);
    return undefined;
  }
}

// ────────────────────────────────────────────────────────────────

/**
 * Master fetcher: gather all Wave 5 enrichment blocks in parallel.
 *
 * `streak` and `subscription` come straight from the user doc (denormalized),
 * so they're returned alongside the sub-collection fetches for type-clean
 * spreading into BuildContextInput.
 */
export async function fetchEnrichmentContext(
  uid: string,
  userData: Record<string, any>,
  activePlanKcal?: number,
): Promise<
  Pick<
    BuildContextInput,
    | 'lastSessionSummary'
    | 'todayFoodLogs'
    | 'recentFormChecks'
    | 'bodyScanRecent'
    | 'wearablesToday'
    | 'streak'
    | 'subscription'
    | 'checkin7DayHistory'
    | 'tdeeHistory'
    | 'recentCoachPatches'
  >
> {
  // Timezone fix : read profile.timezone for proper "today" bucketing.
  // Defaults to Europe/Paris if missing (matches FR-67 product focus).
  const timezone: string | undefined = userData.profile?.timezone;

  const [
    todayFoodLogs,
    recentFormChecks,
    bodyScanRecent,
    wearablesToday,
    checkin7DayHistory,
    tdeeHistory,
    recentCoachPatches,
  ] = await Promise.all([
    fetchTodayFoodLogs(uid, activePlanKcal, timezone),
    fetchRecentFormChecks(uid),
    fetchBodyScanRecent(uid),
    fetchWearablesToday(uid, timezone),
    fetchCheckin7DayHistory(uid, timezone),
    fetchTdeeHistory(uid, 4),
    fetchRecentCoachPatches(uid, 5),
  ]);

  const lastSessionSummary = (userData.last_session_summary as LastSessionSummary | undefined) ?? undefined;
  const streak = (userData.streak as StreakState | undefined) ?? undefined;
  const subscription: SubscriptionContext | undefined = userData.subscription
    ? {
        tier: (userData.subscription.tier ?? 'free') as 'free' | 'premium',
        current_period_end: userData.subscription.current_period_end,
      }
    : undefined;

  return {
    lastSessionSummary,
    todayFoodLogs,
    recentFormChecks,
    bodyScanRecent,
    wearablesToday,
    streak,
    subscription,
    checkin7DayHistory,
    tdeeHistory,
    recentCoachPatches,
  };
}

/**
 * Extract kcal target from a plan doc that may have evolved across versions.
 * Some legacy plans store `daily_calories` / `target_kcal` instead of `kcal`.
 */
export function extractPlanKcal(plan: Record<string, any> | undefined): number | undefined {
  if (!plan) return undefined;
  return plan.kcal ?? plan.target_kcal ?? plan.daily_calories ?? undefined;
}
