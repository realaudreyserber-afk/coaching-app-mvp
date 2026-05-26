/**
 * Wave 13C — Shared UI constants to replace magic numbers scattered across
 * components. Add new entries here rather than inline literals so we have
 * one place to tune behavior.
 */

/** Default duration a toast notification stays visible (ms). */
export const TOAST_DURATION_MS = 2000;

/** Window in which a user's reauth is still considered "fresh" for RGPD
 *  destructive actions (delete account, full data purge). Server-side check
 *  in /api/user/delete enforces this on the auth_time claim. */
export const REAUTH_FRESHNESS_WINDOW_MS = 5 * 60 * 1000;

/** Hard timeout on the SSE streaming coach response before we abort. */
export const COACH_STREAM_TIMEOUT_MS = 90_000;

/** Daily-insight cache TTL on the checkin doc — avoid re-calling Vertex
 *  Flash on every dashboard refresh during the day. */
export const DAILY_INSIGHT_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

/** Number of days to look back when injecting last_performance on a new
 *  workout session. Picks the highest e1RM set per exercise within this
 *  window. */
export const LAST_PERF_LOOKBACK_DAYS = 90;

/** Max number of patch entries accepted in a single <COACH_PLAN_PATCH>.
 *  Beyond this, the user should regenerate the plan instead. */
export const MAX_PATCH_ENTRIES = 10;
