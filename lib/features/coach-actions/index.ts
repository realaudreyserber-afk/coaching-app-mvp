/**
 * COACH ACTIONS — exécution RÉELLE d'actions demandées dans le chat.
 *
 * Le coach (mode multi-agent) ne pouvait rien écrire : il prétendait enregistrer
 * des données sans le faire. Ici, il émet un bloc
 *   <COACH_ACTION>{"type":"log_weight","weight_kg":82,"date":"2026-04-01"}</COACH_ACTION>
 * que la route coach-multi PARSE, VALIDE et APPLIQUE côté serveur, puis retire de
 * l'affichage. Garde-fou : si l'action n'est pas émise/valide, rien n'est écrit
 * (et le prompt interdit au coach de prétendre le contraire).
 *
 * Volontairement minimal + whitelisté (comme coach-patches/plan-patch). Pour
 * l'instant une seule action : log_weight (pesée -> users/{uid}/checkins_daily).
 */

import 'server-only';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

export interface LogWeightAction {
  type: 'log_weight';
  weight_kg: number;
  date?: string; // YYYY-MM-DD ; défaut = aujourd'hui
}
export type CoachAction = LogWeightAction | { type: string; [k: string]: unknown };

export interface ActionResult {
  ok: boolean;
  type: string;
  message: string;
}

const ACTION_RE = /<COACH_ACTION>\s*([\s\S]*?)\s*<\/COACH_ACTION>/gi;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Extrait les blocs <COACH_ACTION> d'une réponse et renvoie le texte nettoyé
 * (sans les blocs, pour l'affichage). Tolère un objet ou un tableau d'objets.
 */
export function parseCoachActions(text: string): { actions: CoachAction[]; cleaned: string } {
  const actions: CoachAction[] = [];
  let m: RegExpExecArray | null;
  ACTION_RE.lastIndex = 0;
  while ((m = ACTION_RE.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(m[1]);
      if (Array.isArray(parsed)) actions.push(...parsed.filter((x) => x && typeof x === 'object'));
      else if (parsed && typeof parsed === 'object') actions.push(parsed);
    } catch {
      /* bloc malformé -> ignoré */
    }
  }
  const cleaned = text.replace(ACTION_RE, '').replace(/\n{3,}/g, '\n\n').trim();
  return { actions, cleaned };
}

/** Applique une action validée. `today` = YYYY-MM-DD (injecté, pas de Date globale). */
export async function applyCoachAction(
  uid: string,
  action: CoachAction,
  today: string,
): Promise<ActionResult> {
  const type = String(action?.type ?? 'unknown');
  if (type !== 'log_weight') {
    return { ok: false, type, message: `Action non supportée: ${type}.` };
  }
  const a = action as LogWeightAction;
  const w = typeof a.weight_kg === 'number' ? a.weight_kg : parseFloat(String(a.weight_kg));
  if (!Number.isFinite(w) || w < 20 || w > 400) {
    return { ok: false, type, message: `Poids invalide (${a.weight_kg} kg). Pesée non enregistrée.` };
  }
  let date = typeof a.date === 'string' && ISO_DATE.test(a.date) ? a.date : today;
  if (date > today) date = today; // pas de pesée dans le futur

  const weight = Math.round(w * 10) / 10;
  try {
    await adminDb
      .collection('users').doc(uid).collection('checkins_daily').doc(date)
      .set(
        {
          weight,
          date,
          // created_at reflète la date de la pesée (la courbe trie par created_at).
          created_at: new Date(`${date}T12:00:00.000Z`).toISOString(),
          updated_at: FieldValue.serverTimestamp(),
          source: 'coach',
        },
        { merge: true },
      );
    return { ok: true, type, message: `Pesée de ${weight} kg enregistrée au ${date}.` };
  } catch {
    return { ok: false, type, message: "Échec de l'enregistrement de la pesée." };
  }
}
