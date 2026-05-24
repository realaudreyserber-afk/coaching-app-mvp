import 'server-only';

type FlagKey =
  | 'barcode' | 'off_db' | 'tdee_adaptive' | 'rag_sourcing' | 'photo_meal'
  | 'glp1' | 'fasting' | 'wearables' | 'profile_paths' | 'body_scanner'
  | 'voice_log' | 'form_check' | 'micro_tasks' | 'recipe_ocr' | 'micronutrients'
  | 'bloodwork_upload' | 'referral' | 'streak' | 'smart_notifs'
  | 'stripe_portal_advanced' | 'admin_dashboard' | 'ab_framework'
  | 'gdpr_self_service' | 'health_connect' | 'healthkit';

let serverTemplateCache: Record<string, boolean> | null = null;
let serverTemplateFetchedAt = 0;
const SERVER_TEMPLATE_TTL_MS = 5 * 60 * 1000;
let inflightServerFetch: Promise<Record<string, boolean>> | null = null;

function getFromEnv(key: FlagKey): boolean | undefined {
  const envVar = `FEATURE_${key.toUpperCase()}`;
  const publicEnvVar = `NEXT_PUBLIC_FEATURE_${key.toUpperCase()}`;
  if (typeof process !== 'undefined' && process.env) {
    if (process.env[envVar] !== undefined) return process.env[envVar] === 'true';
    if (process.env[publicEnvVar] !== undefined) return process.env[publicEnvVar] === 'true';
  }
  return undefined;
}

async function fetchServerTemplate(): Promise<Record<string, boolean>> {
  if (serverTemplateCache && Date.now() - serverTemplateFetchedAt < SERVER_TEMPLATE_TTL_MS) {
    return serverTemplateCache;
  }
  if (inflightServerFetch) return inflightServerFetch;
  inflightServerFetch = (async () => {
    try {
      const { getRemoteConfig } = await import('firebase-admin/remote-config');
      const template = await getRemoteConfig().getTemplate();
      const parsed: Record<string, boolean> = {};
      for (const [k, param] of Object.entries(template.parameters)) {
        if (param?.defaultValue && 'value' in param.defaultValue) {
          parsed[k] = String(param.defaultValue.value) === 'true';
        }
      }
      serverTemplateCache = parsed;
      serverTemplateFetchedAt = Date.now();
      return parsed;
    } catch (err) {
      console.warn('Server Remote Config template fetch failed:', err);
      return {};
    } finally {
      inflightServerFetch = null;
    }
  })();
  return inflightServerFetch;
}

export async function getServerFlag(key: FlagKey, defaultValue = false): Promise<boolean> {
  const template = await fetchServerTemplate();
  const v = template[`feature_${key}`];
  if (typeof v === 'boolean') return v;
  const fromEnv = getFromEnv(key);
  return fromEnv ?? defaultValue;
}
