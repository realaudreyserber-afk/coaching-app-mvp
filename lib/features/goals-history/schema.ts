/**
 * Phase 10 data-layer — Historique des objectifs.
 *
 * Stockage : users/{uid}/goals_history/{archived_at}
 * Le doc id est un timestamp ISO ou un auto-id.
 *
 * Pourquoi : avant cette phase, `goals` était un sous-doc unique du profile
 * sans historique. Si l'user changeait d'objectif 5 fois sur 12 mois, on
 * perdait toute la trajectoire d'évolution.
 *
 * Mécanisme : trigger automatique dans /api/profile/update-fields : avant
 * d'écrire un patch sur goals.*, snapshot l'ancien dans goals_history/.
 */

import { z } from 'zod';

export const GoalsSnapshotSchema = z.object({
  primary_goal: z.string().optional(),
  target_weight: z.number().optional(),
  target_bf_pct: z.number().optional(),
  type: z.string().optional(),
  deadline: z.string().optional(),
});

export type GoalsSnapshot = z.infer<typeof GoalsSnapshotSchema>;

export const GoalsHistoryEntrySchema = z.object({
  /** ISO timestamp d'archivage (= moment où le user a changé d'objectif) */
  archived_at: z.string(),
  /** Snapshot des goals PRÉCÉDENTS (juste avant le changement) */
  previous_goals: GoalsSnapshotSchema,
  /** Raison du changement (optionnel — l'user peut la fournir via UI) */
  reason_for_change: z.string().max(300).optional(),
});

export type GoalsHistoryEntry = z.infer<typeof GoalsHistoryEntrySchema>;
