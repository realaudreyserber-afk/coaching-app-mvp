/**
 * Suivi d'hydratation — Phase 4 data-layer.
 *
 * Stockage : users/{uid}/hydration_log/{YYYY-MM-DD} → 1 doc par jour
 * avec un array d'entries (chaque prise = time + ml).
 *
 * Pourquoi un doc par jour (pas par entry) : un user boit 5-15× par jour.
 * Doc par jour réduit le nombre de docs Firestore (cost + read latency).
 *
 * Targets standard : 2.5L/jour baseline, 3-4L si TRT (épaissit sang) ou GLP-1
 * (réduit soif), 4-5L si chaleur ou training intense.
 */

import { z } from 'zod';

export const HydrationEntrySchema = z.object({
  /** HH:MM */
  time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  /** Quantité en ml */
  ml: z.number().int().min(50).max(2000),
  /** Type de boisson (eau par défaut, mais alcool/café peuvent compter en négatif) */
  type: z.enum(['water', 'tea', 'coffee', 'sparkling', 'electrolyte', 'other']).default('water'),
});

export type HydrationEntry = z.infer<typeof HydrationEntrySchema>;

export const HydrationLogSchema = z.object({
  /** YYYY-MM-DD */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Liste des prises du jour */
  entries: z.array(HydrationEntrySchema).default([]),
  /** Total ml du jour (denormalized pour lecture rapide) */
  total_ml: z.number().int().min(0).default(0),
  /** Target ml du jour (peut varier selon contexte — TRT, training, météo) */
  target_ml: z.number().int().min(500).max(8000).default(2500),
  /** Timestamp serveur */
  updated_at: z.string().optional(),
});

export type HydrationLog = z.infer<typeof HydrationLogSchema>;

/**
 * Compte les ml d'une liste d'entries. L'eau et l'eau pétillante comptent à 100%.
 * Le thé et café à 80%. L'électrolyte à 100%. Les autres pas comptabilisés
 * (alcool est diurétique → compté ailleurs dans substances_log).
 */
export function effectiveHydrationMl(entries: HydrationEntry[]): number {
  let total = 0;
  for (const e of entries) {
    switch (e.type) {
      case 'water':
      case 'sparkling':
      case 'electrolyte':
        total += e.ml;
        break;
      case 'tea':
      case 'coffee':
        total += Math.round(e.ml * 0.8);
        break;
      default:
        // 'other' → on ne compte pas (sodas/jus sont plutôt dans substances_log)
        break;
    }
  }
  return total;
}

/**
 * Calcule un target par défaut selon le profil.
 * Baseline 2500 ml, +500 ml si TRT, +500 ml si GLP-1, +500-1000 ml si training intense.
 */
export function computeDefaultTargetMl(profile: {
  hormonal_context?: string;
  uses_glp1?: boolean;
  activity_level?: string;
}): number {
  let target = 2500;
  if (profile.hormonal_context === 'trt') target += 500;
  if (profile.uses_glp1) target += 500;
  if (profile.activity_level === 'very_active') target += 750;
  else if (profile.activity_level === 'active') target += 500;
  return target;
}
