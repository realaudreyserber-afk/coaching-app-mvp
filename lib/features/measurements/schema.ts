/**
 * Mensurations corporelles évolutives — fix du bug data existant.
 *
 * AVANT : `users/{uid}.profile.waist_cm` (et autres) = UNIQUE valeur, historique perdu.
 * APRÈS : `users/{uid}/measurements/{YYYY-MM-DD}` = 1 doc par mesure, time series.
 *
 * Stratégie compat :
 *   - profile.*_cm RESTE pour lecture rapide du dernier (compat existant)
 *   - Source de vérité = collection measurements
 *   - /api/profile/update-fields écrit dans LES DEUX (profile + measurements/{today})
 *   - Migration : script one-shot pour seeder measurements depuis profile actuel
 *
 * Lecture côté agents :
 *   - AnalyticsCoach : trends (tour de taille baisse alors que poids stagne = recompo)
 *   - PlanningCoach : long-terme (évolution composition vs goal)
 */

import { z } from 'zod';

export const MeasurementEntrySchema = z.object({
  /** YYYY-MM-DD */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Source de la mesure */
  source: z.enum(['self', 'coach', 'dexa', 'inbody', 'bodpod', 'caliper', 'navy', 'photo']).default('self'),
  /** Tour de taille (cm, au nombril, expiration) */
  waist_cm: z.number().min(40).max(200).optional(),
  /** Tour de cou (cm, sous pomme d'Adam) */
  neck_cm: z.number().min(25).max(70).optional(),
  /** Tour de hanches (cm) */
  hips_cm: z.number().min(50).max(200).optional(),
  /** Largeur épaules (cm) — Adonis Index */
  shoulder_cm: z.number().min(90).max(180).optional(),
  /** Tour de poitrine (cm) */
  chest_cm: z.number().min(60).max(180).optional(),
  /** Tour de bras (cm, contracté) */
  arm_cm: z.number().min(20).max(65).optional(),
  /** Tour d'avant-bras (cm) */
  forearm_cm: z.number().min(15).max(50).optional(),
  /** Tour de poignet (cm) */
  wrist_cm: z.number().min(10).max(25).optional(),
  /** Tour de cuisse (cm) */
  thigh_cm: z.number().min(30).max(100).optional(),
  /** Tour de mollet (cm) */
  calf_cm: z.number().min(20).max(60).optional(),
  /** Poids au moment de la mesure (kg) — optionnel pour corrélation */
  weight_kg: z.number().min(30).max(300).optional(),
  /** BF% si mesuré ce jour (DEXA, BIA, caliper, etc.) */
  bf_pct: z.number().min(3).max(60).optional(),
  /** Notes libres */
  notes: z.string().max(500).optional(),
  /** Timestamp serveur */
  updated_at: z.string().optional(),
});

export type MeasurementEntry = z.infer<typeof MeasurementEntrySchema>;

/** Liste des champs mensurations (utilisée pour la migration + l'extraction depuis profile) */
export const MEASUREMENT_FIELDS = [
  'waist_cm',
  'neck_cm',
  'hips_cm',
  'shoulder_cm',
  'chest_cm',
  'arm_cm',
  'forearm_cm',
  'wrist_cm',
  'thigh_cm',
  'calf_cm',
] as const;

export type MeasurementField = (typeof MEASUREMENT_FIELDS)[number];

/**
 * Mappe les mensurations du check-in hebdo (checkins_weekly / baseline) vers les
 * champs canoniques `*_cm`. Schémas non superposables :
 *   - hebdo a thigh_l/thigh_r + arm_l/arm_r (G/D) → moyennés en thigh_cm / arm_cm
 *     (c'est DÉJÀ ce qui est affiché partout : (arm_l+arm_r)/2). G/D bruts conservés
 *     côté checkins_weekly (zéro perte).
 *   - hebdo n'a ni shoulder/chest/forearm/wrist/calf → simplement absents.
 * 0 = champ non renseigné (convention du formulaire hebdo) → ignoré.
 */
export function weeklyToMeasurementFields(
  m: Record<string, unknown> | undefined | null,
): Partial<Record<MeasurementField, number>> {
  const out: Partial<Record<MeasurementField, number>> = {};
  if (!m) return out;
  const num = (v: unknown): number | null => (typeof v === 'number' && v > 0 ? v : null);
  const round1 = (n: number) => Math.round(n * 10) / 10;
  const neck = num(m.neck); if (neck !== null) out.neck_cm = neck;
  const waist = num(m.waist); if (waist !== null) out.waist_cm = waist;
  const hips = num(m.hips); if (hips !== null) out.hips_cm = hips;
  const arms = [num(m.arm_l), num(m.arm_r)].filter((x): x is number => x !== null);
  if (arms.length) out.arm_cm = round1(arms.reduce((a, b) => a + b, 0) / arms.length);
  const thighs = [num(m.thigh_l), num(m.thigh_r)].filter((x): x is number => x !== null);
  if (thighs.length) out.thigh_cm = round1(thighs.reduce((a, b) => a + b, 0) / thighs.length);
  return out;
}

/**
 * Fusionne les sources de mensurations en UNE série canonique (source de vérité
 * = collection `measurements`). Par (date, champ) : la valeur canonique (A) gagne ;
 * sinon on complète avec l'hebdo / la baseline (B). Aucune valeur n'est écrasée →
 * zéro perte. Retourne la série triée par date croissante.
 */
export function mergeUnifiedEntries(
  canonical: MeasurementEntry[],
  weekly: Array<{ date: string; fields: Partial<Record<MeasurementField, number>> }>,
  baseline?: { date: string; fields: Partial<Record<MeasurementField, number>> },
): MeasurementEntry[] {
  const byDate = new Map<string, MeasurementEntry>();
  // 1) Graine = canonique (A) : prioritaire, jamais écrasé.
  for (const e of canonical) {
    if (e?.date) byDate.set(e.date, { ...e });
  }
  // 2) Complète avec B (hebdo puis baseline) sans écraser les champs déjà posés.
  const fill = (date: string, fields: Partial<Record<MeasurementField, number>>) => {
    if (!date) return;
    const cur = byDate.get(date) ?? { date, source: 'self' as const };
    for (const [k, v] of Object.entries(fields)) {
      if (typeof v === 'number' && typeof (cur as Record<string, unknown>)[k] !== 'number') {
        (cur as Record<string, unknown>)[k] = v;
      }
    }
    byDate.set(date, cur);
  };
  for (const w of weekly) fill(w.date, w.fields);
  if (baseline) fill(baseline.date, baseline.fields);
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

/**
 * Calcule la variation absolue + % entre deux entries.
 * Retourne null si l'une des deux valeurs est absente.
 */
export function deltaBetween(
  field: MeasurementField,
  earlier: MeasurementEntry,
  later: MeasurementEntry,
): { abs_cm: number; pct: number } | null {
  const earlierVal = earlier[field];
  const laterVal = later[field];
  if (typeof earlierVal !== 'number' || typeof laterVal !== 'number') return null;
  const abs_cm = Math.round((laterVal - earlierVal) * 100) / 100;
  const pct = earlierVal > 0 ? Math.round(((abs_cm / earlierVal) * 100) * 100) / 100 : 0;
  return { abs_cm, pct };
}
