/**
 * Helpers CLIENT pour les balises émises par le coach dans le flux SSE.
 *
 * - <COACH_ACTION> (log_weight/measurement/hydration/pr) est appliqué CÔTÉ
 *   SERVEUR (coach-route-adapter) — le client n'a qu'à le masquer.
 * - <COACH_SAVE> (profil/objectif) et <COACH_PLAN_PATCH> (plan) sont appliqués
 *   CÔTÉ CLIENT en POSTant vers les endpoints dédiés (mêmes que coach/page.tsx).
 *
 * Utilisé par le widget coach flottant (et réutilisable par la page coach).
 */

/** Retire toutes les balises coach pour l'affichage. */
export function stripCoachTags(text: string): string {
  return text
    .replace(/<COACH_SAVE>[\s\S]*?<\/COACH_SAVE>/g, '')
    .replace(/<COACH_PLAN_PATCH>[\s\S]*?<\/COACH_PLAN_PATCH>/g, '')
    .replace(/<COACH_ACTION>[\s\S]*?<\/COACH_ACTION>/g, '')
    // balise ouvrante orpheline (génération coupée) -> jusqu'à la fin
    .replace(/<COACH_(SAVE|PLAN_PATCH|ACTION)>[\s\S]*$/g, '')
    // fermantes orphelines
    .replace(/<\/COACH_(SAVE|PLAN_PATCH|ACTION)>/g, '')
    .trim();
}

type TokenGetter = () => Promise<string | null>;

async function postJson(url: string, body: unknown, token: string): Promise<void> {
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  } catch (e) {
    console.warn('[coach-widget] post failed:', url, e);
  }
}

/** Applique un <COACH_SAVE>{...}</COACH_SAVE> (profil/objectif) via update-fields. */
export async function applyCoachSave(content: string, getToken: TokenGetter): Promise<void> {
  const m = content.match(/<COACH_SAVE>([\s\S]*?)<\/COACH_SAVE>/);
  if (!m) return;
  let updates: unknown;
  try { updates = JSON.parse(m[1].trim()); } catch { return; }
  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) return;
  if (Object.keys(updates as object).length === 0) return;
  const token = await getToken();
  if (!token) return;
  await postJson('/api/profile/update-fields', { updates }, token);
}

/** Applique un <COACH_PLAN_PATCH>{...}</COACH_PLAN_PATCH> (plan) via apply-patch. */
export async function applyCoachPlanPatch(content: string, getToken: TokenGetter): Promise<void> {
  const m = content.match(/<COACH_PLAN_PATCH>([\s\S]*?)<\/COACH_PLAN_PATCH>/);
  if (!m) return;
  let patch: unknown;
  try { patch = JSON.parse(m[1].trim()); } catch { return; }
  if (!patch || typeof patch !== 'object') return;
  if (Array.isArray(patch) ? patch.length === 0 : Object.keys(patch as object).length === 0) return;
  const token = await getToken();
  if (!token) return;
  await postJson('/api/coach/apply-patch', { patch, reason: 'coach_widget_emit' }, token);
}
