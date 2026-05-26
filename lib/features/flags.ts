/**
 * Client-side feature flag resolution.
 *
 * Order:
 *   1. Firebase Remote Config (client SDK, cached 5min)
 *   2. Environment variables (NEXT_PUBLIC_FEATURE_*)
 *   3. localStorage override (development only)
 *   4. Default value (false)
 *
 * Server-side flags live in flags-server.ts (uses firebase-admin).
 * Premium-gated features should ALSO check tier server-side — flags alone are
 * not a security boundary.
 */

type FlagKey =
  | 'barcode' | 'off_db' | 'tdee_adaptive' | 'rag_sourcing' | 'photo_meal'
  | 'glp1' | 'fasting' | 'wearables' | 'profile_paths' | 'body_scanner'
  | 'voice_log' | 'form_check' | 'micro_tasks' | 'recipe_ocr' | 'micronutrients'
  | 'bloodwork_upload' | 'referral' | 'streak' | 'smart_notifs'
  | 'stripe_portal_advanced' | 'admin_dashboard' | 'ab_framework'
  | 'gdpr_self_service' | 'health_connect' | 'healthkit'
  | 'session_live' | 'coach_audio';

let remoteCache: Record<string, boolean> | null = null;
let remoteCachedAt = 0;
const REMOTE_TTL_MS = 5 * 60 * 1000;

async function fetchRemoteConfigClient(): Promise<Record<string, boolean>> {
  if (typeof window === 'undefined') return {};
  if (remoteCache && Date.now() - remoteCachedAt < REMOTE_TTL_MS) return remoteCache;
  try {
    const { getRemoteConfig, fetchAndActivate, getAll } = await import('firebase/remote-config');
    const { app } = await import('@/lib/firebase/client');
    const rc = getRemoteConfig(app);
    rc.settings.minimumFetchIntervalMillis = REMOTE_TTL_MS;
    await fetchAndActivate(rc);
    const all = getAll(rc);
    const parsed: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(all)) {
      parsed[k] = v.asBoolean();
    }
    remoteCache = parsed;
    remoteCachedAt = Date.now();
    return parsed;
  } catch (err) {
    console.warn('Remote Config fetch failed, using env/localStorage:', err);
    return {};
  }
}

function getFromEnv(key: FlagKey): boolean | undefined {
  const envVar = `FEATURE_${key.toUpperCase()}`;
  const publicEnvVar = `NEXT_PUBLIC_FEATURE_${key.toUpperCase()}`;
  if (typeof process !== 'undefined' && process.env) {
    if (process.env[envVar] !== undefined) return process.env[envVar] === 'true';
    if (process.env[publicEnvVar] !== undefined) return process.env[publicEnvVar] === 'true';
  }
  return undefined;
}

function getFromLocalStorage(key: FlagKey): boolean | undefined {
  if (typeof window === 'undefined') return undefined;
  if (process.env.NODE_ENV !== 'development') return undefined;
  try {
    const v = window.localStorage.getItem(`feature_${key.toLowerCase()}`);
    if (v === null) return undefined;
    return v === 'true';
  } catch {
    return undefined;
  }
}

function resolveSync(key: FlagKey, defaultValue = false): boolean {
  if (remoteCache && key in remoteCache) return remoteCache[key];
  const fromEnv = getFromEnv(key);
  if (fromEnv !== undefined) return fromEnv;
  const fromLocal = getFromLocalStorage(key);
  if (fromLocal !== undefined) return fromLocal;
  return defaultValue;
}

export async function refreshFlags(): Promise<void> {
  await fetchRemoteConfigClient();
}

export const flags = {
  barcode: () => resolveSync('barcode'),
  offDb: () => resolveSync('off_db'),
  tdeeAdaptive: () => resolveSync('tdee_adaptive'),
  ragSourcing: () => resolveSync('rag_sourcing'),
  photoMeal: () => resolveSync('photo_meal'),
  glp1: () => resolveSync('glp1'),
  fasting: () => resolveSync('fasting'),
  wearables: () => resolveSync('wearables'),
  profilePaths: () => resolveSync('profile_paths'),
  bodyScanner: () => resolveSync('body_scanner'),
  voiceLog: () => resolveSync('voice_log'),
  formCheck: () => resolveSync('form_check'),
  microTasks: () => resolveSync('micro_tasks'),
  recipeOcr: () => resolveSync('recipe_ocr'),
  micronutrients: () => resolveSync('micronutrients'),
  bloodworkUpload: () => resolveSync('bloodwork_upload'),
  referral: () => resolveSync('referral'),
  streak: () => resolveSync('streak'),
  smartNotifs: () => resolveSync('smart_notifs'),
  stripePortalAdvanced: () => resolveSync('stripe_portal_advanced'),
  adminDashboard: () => resolveSync('admin_dashboard'),
  abFramework: () => resolveSync('ab_framework'),
  gdprSelfService: () => resolveSync('gdpr_self_service'),
  healthConnect: () => resolveSync('health_connect'),
  healthkit: () => resolveSync('healthkit'),
  sessionLive: () => resolveSync('session_live'),
  coachAudio: () => resolveSync('coach_audio'),
};
