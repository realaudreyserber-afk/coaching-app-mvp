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
} from './context-builder';

/**
 * Returns the YYYY-MM-DD slug in the user's local timezone (or fallback UTC).
 * We use local TZ to align with how check-ins and food logs are bucketed in
 * UI (which uses `new Date().toISOString().split('T')[0]` server-side and
 * local-time client-side — a known inconsistency to revisit in Wave 6).
 */
function todayIsoYmd(): string {
  return new Date().toISOString().split('T')[0];
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
): Promise<TodayFoodLogsSummary | undefined> {
  try {
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);
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
      date: todayIsoYmd(),
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
async function fetchWearablesToday(uid: string): Promise<WearablesToday | undefined> {
  try {
    const today = todayIsoYmd();
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
  >
> {
  const [todayFoodLogs, recentFormChecks, bodyScanRecent, wearablesToday] =
    await Promise.all([
      fetchTodayFoodLogs(uid, activePlanKcal),
      fetchRecentFormChecks(uid),
      fetchBodyScanRecent(uid),
      fetchWearablesToday(uid),
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
