/**
 * COACH ACTIONS — exécution RÉELLE d'actions dictées dans le chat (multi-agent).
 *
 * Le coach émet un bloc <COACH_ACTION>{...}</COACH_ACTION> ; la route coach-multi
 * PARSE -> VALIDE -> APPLIQUE côté serveur -> retire le bloc de l'affichage.
 * Whitelist FERMÉE : un type inconnu n'écrit rien.
 *
 * IMPORTANT (cf. concertation 2026-05-30) :
 *  - La sécurité vit ICI (re-validation serveur via les schémas Zod existants),
 *    PAS dans firestore.rules — le coach tourne en admin SDK et les bypasse.
 *  - Le coach ne dit "c'est fait" QUE via une action réellement exécutée
 *    (ActionResult.ok). Toute nouvelle action doit être ajoutée EN MÊME TEMPS
 *    dans le prompt (actionsBlock de buildAggregatePrompt).
 *
 * Actions immédiates (chiffres factuels dictés, append/merge réversible) :
 *   log_weight, log_measurement, log_hydration, log_pr.
 */

import 'server-only';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { upsertMeasurement } from '@/lib/features/measurements/store';
import { MeasurementEntrySchema, MEASUREMENT_FIELDS } from '@/lib/features/measurements/schema';
import { appendPr } from '@/lib/features/personal-records/store';
import { epley1RM } from '@/lib/features/personal-records/schema';

export interface ActionResult {
  ok: boolean;
  type: string;
  message: string;
}
export type CoachAction = { type: string; [k: string]: unknown };

const ACTION_RE = /<COACH_ACTION>\s*([\s\S]*?)\s*<\/COACH_ACTION>/gi;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Extrait les blocs <COACH_ACTION> + renvoie le texte nettoyé (sans blocs). */
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

function num(v: unknown): number {
  return typeof v === 'number' ? v : parseFloat(String(v));
}
/** Date valide YYYY-MM-DD, pas dans le futur ; sinon today. */
function safeDate(v: unknown, today: string): string {
  const d = typeof v === 'string' && ISO_DATE.test(v) ? v : today;
  return d > today ? today : d;
}

// ---- Handlers ---------------------------------------------------------------

async function logWeight(uid: string, a: CoachAction, today: string): Promise<ActionResult> {
  const w = num(a.weight_kg);
  if (!Number.isFinite(w) || w < 20 || w > 400) {
    return { ok: false, type: 'log_weight', message: `Poids invalide (${a.weight_kg} kg).` };
  }
  const weight = Math.round(w * 10) / 10;
  const date = safeDate(a.date, today);
  await adminDb.collection('users').doc(uid).collection('checkins_daily').doc(date).set(
    {
      weight, date,
      created_at: new Date(`${date}T12:00:00.000Z`).toISOString(),
      updated_at: FieldValue.serverTimestamp(),
      source: 'coach',
    },
    { merge: true },
  );
  return { ok: true, type: 'log_weight', message: `Pesée de ${weight} kg enregistrée au ${date}.` };
}

async function logMeasurement(uid: string, a: CoachAction, today: string): Promise<ActionResult> {
  const date = safeDate(a.date, today);
  const entry: Record<string, unknown> = { date, source: 'coach' };
  const fields = [...MEASUREMENT_FIELDS, 'weight_kg', 'bf_pct'];
  let n = 0;
  for (const f of fields) {
    if (typeof a[f] === 'number') { entry[f] = a[f]; n++; }
  }
  if (n === 0) return { ok: false, type: 'log_measurement', message: 'Aucune mensuration reconnue.' };
  const parsed = MeasurementEntrySchema.safeParse(entry);
  if (!parsed.success) {
    return { ok: false, type: 'log_measurement', message: 'Mensuration hors bornes — non enregistrée.' };
  }
  const ok = await upsertMeasurement(uid, parsed.data);
  const labels = Object.keys(entry).filter((k) => k !== 'date' && k !== 'source').join(', ');
  return ok
    ? { ok: true, type: 'log_measurement', message: `Mensurations enregistrées (${labels}) au ${date}.` }
    : { ok: false, type: 'log_measurement', message: "Échec de l'enregistrement des mensurations." };
}

async function logHydration(uid: string, a: CoachAction, today: string): Promise<ActionResult> {
  let ml = Math.round(num(a.ml));
  if (!Number.isFinite(ml) || ml < 50) {
    return { ok: false, type: 'log_hydration', message: `Quantité invalide (${a.ml} ml).` };
  }
  if (ml > 2000) ml = 2000; // borne par prise (schéma)
  const allowed = ['water', 'tea', 'coffee', 'sparkling', 'electrolyte', 'other'];
  const type = allowed.includes(String(a.drink_type)) ? String(a.drink_type) : 'water';
  const time = new Date().toISOString().slice(11, 16); // HH:MM
  const ref = adminDb.collection('users').doc(uid).collection('hydration_log').doc(today);
  const snap = await ref.get();
  const data = (snap.exists ? snap.data() : null) as { entries?: Array<{ time: string; ml: number; type: string }>; target_ml?: number } | null;
  const entries = [...(data?.entries ?? []), { time, ml, type }];
  const total_ml = entries.reduce((s, e) => s + (e.ml || 0), 0);
  await ref.set(
    { date: today, entries, total_ml, target_ml: data?.target_ml ?? 2500, updated_at: FieldValue.serverTimestamp() },
    { merge: true },
  );
  return { ok: true, type: 'log_hydration', message: `${ml} ml (${type}) enregistrés. Total du jour : ${total_ml} ml.` };
}

async function logPr(uid: string, a: CoachAction, today: string): Promise<ActionResult> {
  const exercise = String(a.exercise ?? '').trim();
  if (exercise.length < 2) return { ok: false, type: 'log_pr', message: 'Exercice non précisé.' };
  const w = num(a.weight_kg);
  const reps = Number.isFinite(num(a.reps)) ? Math.round(num(a.reps)) : 1;
  if (!Number.isFinite(w) || w <= 0 || w > 500 || reps < 1 || reps > 50) {
    return { ok: false, type: 'log_pr', message: `Charge/reps invalides (${a.weight_kg} kg × ${a.reps}).` };
  }
  const weight = Math.round(w * 10) / 10;
  const e1rm = epley1RM(weight, reps);
  const date = safeDate(a.date, today);
  const ok = await appendPr(uid, exercise, { date, weight_kg: weight, reps, estimated_1rm: e1rm, source: 'manual' });
  return ok
    ? { ok: true, type: 'log_pr', message: `PR enregistré : ${exercise} ${weight} kg × ${reps} (1RM estimé ${e1rm} kg).` }
    : { ok: false, type: 'log_pr', message: "Échec de l'enregistrement du PR." };
}

/** Dispatcher unique. `today` = YYYY-MM-DD (injecté). Whitelist fermée. */
export async function applyCoachAction(
  uid: string,
  action: CoachAction,
  today: string,
): Promise<ActionResult> {
  const type = String(action?.type ?? 'unknown');
  switch (type) {
    case 'log_weight': return logWeight(uid, action, today);
    case 'log_measurement': return logMeasurement(uid, action, today);
    case 'log_hydration': return logHydration(uid, action, today);
    case 'log_pr': return logPr(uid, action, today);
    default: return { ok: false, type, message: `Action non supportée: ${type}.` };
  }
}
