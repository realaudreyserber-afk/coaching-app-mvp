/**
 * Schémas Zod pour le suivi du cycle menstruel.
 *
 * Stockage :
 *   - users/{uid}/cycles/{YYYY-MM-DD} → 1 doc par jour (CycleEntry)
 *   - users/{uid}/cycle_settings/main → 1 doc de config (CycleSettings)
 *
 * Visibilité UI : page /cycle uniquement si profile.sex === 'female'.
 * Fetch agent : conditionné aussi par profile.sex === 'female'.
 *
 * Privacy : data sensible, owner-only via firestore rules.
 */

import { z } from 'zod';

export const CyclePhaseSchema = z.enum([
  'menstrual', // jours de règles
  'follicular', // post-règles → pré-ovulation
  'ovulation', // ovulation (jour J ± 1)
  'luteal', // post-ovulation → pré-règles
]);

export type CyclePhase = z.infer<typeof CyclePhaseSchema>;

export const CycleSymptomSchema = z.enum([
  'cramps', // douleurs abdominales
  'headache',
  'mood_low',
  'mood_irritable',
  'bloating', // ballonnements
  'breast_tenderness',
  'fatigue',
  'acne',
  'sleep_disrupted',
  'cravings_sweet',
  'cravings_salty',
  'libido_high',
  'libido_low',
  'energy_high',
  'energy_low',
]);

export type CycleSymptom = z.infer<typeof CycleSymptomSchema>;

export const CycleEntrySchema = z.object({
  /** YYYY-MM-DD (jour local user) */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Phase si connue/inférée. Optionnel — peut être calculé par cycle_settings + dernière période. */
  phase: CyclePhaseSchema.optional(),
  /** Symptômes du jour */
  symptoms: z.array(CycleSymptomSchema).default([]),
  /** Intensité du flux 0 (rien) → 3 (abondant). 0 = pas en règles. */
  flow_intensity: z.number().int().min(0).max(3).default(0),
  /** Note libre courte */
  notes: z.string().max(500).optional(),
  /** true si phase a été prédite par algo, false si user a explicitement marqué */
  predicted: z.boolean().default(false),
  /** Server timestamp à l'écriture */
  updated_at: z.string().optional(),
});

export type CycleEntry = z.infer<typeof CycleEntrySchema>;

export const CycleSettingsSchema = z.object({
  /** Longueur moyenne du cycle en jours (typique 28, range 21-35) */
  avg_cycle_length_days: z.number().int().min(15).max(60).default(28),
  /** Longueur moyenne des règles (typique 5, range 2-10) */
  avg_period_length_days: z.number().int().min(1).max(15).default(5),
  /** Régularité auto-évaluée */
  regularity: z.enum(['regular', 'irregular', 'unknown']).default('unknown'),
  /** ISO date où le tracking a commencé */
  tracking_started_at: z.string().optional(),
  /** Contraception hormonale impactant le cycle */
  hormonal_contraception: z
    .object({
      active: z.boolean(),
      type: z
        .enum(['pill_combined', 'pill_progestin', 'iud_hormonal', 'implant', 'ring', 'patch', 'injection', 'other'])
        .optional(),
      start_date: z.string().optional(),
    })
    .optional(),
  /** Server timestamp à la mise à jour */
  updated_at: z.string().optional(),
});

export type CycleSettings = z.infer<typeof CycleSettingsSchema>;

/**
 * Calcule la phase théorique d'un jour donné en fonction de la date de
 * dernière règle connue et de la longueur moyenne du cycle.
 *
 * @param dateIso - date pour laquelle on veut la phase (YYYY-MM-DD)
 * @param lastPeriodStartIso - date du début de la dernière période (YYYY-MM-DD)
 * @param avgCycleLength - longueur moyenne du cycle (jours)
 * @param avgPeriodLength - longueur moyenne des règles (jours)
 */
export function computeCyclePhase(
  dateIso: string,
  lastPeriodStartIso: string,
  avgCycleLength = 28,
  avgPeriodLength = 5,
): CyclePhase | null {
  const dateT = new Date(dateIso).getTime();
  const lastT = new Date(lastPeriodStartIso).getTime();
  if (Number.isNaN(dateT) || Number.isNaN(lastT)) return null;
  if (dateT < lastT) return null;

  const dayInCycle = Math.floor((dateT - lastT) / (24 * 60 * 60 * 1000)) % avgCycleLength;

  if (dayInCycle < avgPeriodLength) return 'menstrual';
  // Ovulation typiquement J14 sur cycle 28 = avgCycleLength - 14
  const ovulationDay = avgCycleLength - 14;
  if (dayInCycle < ovulationDay - 1) return 'follicular';
  if (dayInCycle <= ovulationDay + 1) return 'ovulation';
  return 'luteal';
}
