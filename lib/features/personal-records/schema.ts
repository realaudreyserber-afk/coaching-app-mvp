/**
 * Personal Records (PR) — historique des records par exercice.
 *
 * Stockage : `users/{uid}/prs/{exerciseId}` → 1 doc par exo avec history.
 * `exerciseId` = name_fr de l'exo en kebab-case (ex: "squat-barre", "developpe-couche").
 *
 * Population auto : à la fin de chaque workout_session, /api/sessions/[id]/finish
 * parse les exos, calcule 1RM via formule Epley, et update si nouveau record.
 *
 * Lecture côté agents :
 *   - TrainingCoach : "ton bench a progressé de 8% en 2 mois, on peut pousser"
 *   - AnalyticsCoach : performance trend en complément du poids/BF
 */

import { z } from 'zod';

export const PrEntrySchema = z.object({
  /** ISO date au format YYYY-MM-DD */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Poids soulevé (kg) */
  weight_kg: z.number().min(0).max(500),
  /** Nombre de reps réalisées */
  reps: z.number().int().min(1).max(50),
  /** 1RM estimé via formule (Epley par défaut) */
  estimated_1rm: z.number().min(0).max(500),
  /** Source de l'entry */
  source: z.enum(['manual', 'auto_from_session']),
  /** Référence session si auto */
  session_id: z.string().optional(),
  /** Note libre (ex: "RPE 9", "bonne forme") */
  notes: z.string().max(200).optional(),
});

export type PrEntry = z.infer<typeof PrEntrySchema>;

export const PrSchema = z.object({
  /** kebab-case du nom exo (ex: "squat-barre") */
  exercise_id: z.string(),
  /** Nom affichage (name_fr du RAG exos) */
  exercise_name: z.string(),
  /** Historique des PR atteints (chronologique asc par date) */
  prs: z.array(PrEntrySchema).default([]),
  /** Dernier 1RM courant (pour lecture rapide sans parser prs[]) */
  current_1rm: z.number().min(0).max(500).default(0),
  /** Date du dernier PR */
  last_pr_date: z.string().optional(),
  /** Timestamp serveur */
  updated_at: z.string().optional(),
});

export type Pr = z.infer<typeof PrSchema>;

/**
 * Formule Epley : 1RM = poids × (1 + reps/30)
 * Sources : Mayhew 1992, Knutzen 1999.
 * Bonne approximation pour reps 1-10. Au-delà devient imprécis.
 */
export function epley1RM(weight: number, reps: number): number {
  if (reps < 1) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

/**
 * Formule Brzycki : alternative, légèrement plus conservatrice à reps > 5.
 * Utilisée comme cross-check.
 */
export function brzycki1RM(weight: number, reps: number): number {
  if (reps < 1) return 0;
  if (reps === 1) return weight;
  if (reps >= 37) return weight; // formule invalide au-delà
  return Math.round((weight * 36) / (37 - reps) * 10) / 10;
}

/**
 * Slugifie un nom d'exo en kebab-case pour utiliser comme doc ID.
 * Ex: "Développé couché à la barre" → "developpe-couche-a-la-barre"
 */
export function exerciseNameToId(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * Liste blanche des exos composés clés où on track les PR.
 * Évite de polluer prs/ avec des isolations type "curl biceps" qui ne sont
 * pas des indicateurs de progression force significatifs.
 */
export const PR_TRACKED_EXERCISES_PATTERNS = [
  /squat/i,
  /developpe.*couche/i,
  /bench/i,
  /soulev[eé].*terre/i,
  /deadlift/i,
  /developpe.*militaire/i,
  /press.*militaire/i,
  /ohp/i,
  /overhead.*press/i,
  /rowing.*barre/i,
  /pendlay/i,
  /traction/i,
  /pull.up/i,
  /chin.up/i,
  /front.squat/i,
  /clean/i,
  /snatch/i,
  /hip.thrust/i,
];

export function shouldTrackPr(exerciseName: string): boolean {
  return PR_TRACKED_EXERCISES_PATTERNS.some((p) => p.test(exerciseName));
}
