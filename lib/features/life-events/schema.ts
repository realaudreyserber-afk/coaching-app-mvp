/**
 * Phase 8 data-layer — Événements de vie impactant le parcours.
 *
 * Stockage : users/{uid}/life_events/{eventId}
 *
 * Contexte critique pour les agents mental, planning et safety :
 *   - Déménagement, rupture, deuil, voyage, blessure, maladie
 *   - Burnout, changement pro, événement familial
 *
 * Sans cette data, le coach traite un user en burnout pro avec les mêmes
 * exigences qu'un user en stabilité = erreur de coaching.
 */

import { z } from 'zod';

export const LifeEventTypeSchema = z.enum([
  'move', // déménagement
  'breakup', // rupture / divorce
  'work_change', // changement pro (nouveau job, promotion, démission)
  'work_stress', // période de surcharge pro / burnout
  'loss', // deuil
  'travel', // voyage long (>1 sem)
  'injury', // blessure
  'illness', // maladie
  'family', // événement familial (mariage, naissance, conflit)
  'financial', // stress financier marqué
  'positive', // gros événement positif (réussite, opportunité)
  'other',
]);

export type LifeEventType = z.infer<typeof LifeEventTypeSchema>;

export const LifeEventSeveritySchema = z.enum(['low', 'medium', 'high']);
export type LifeEventSeverity = z.infer<typeof LifeEventSeveritySchema>;

export const LifeEventSchema = z.object({
  /** ISO date YYYY-MM-DD début (peut être passé ou futur) */
  date_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** ISO date fin (optionnel — si null/absent = en cours) */
  date_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  type: LifeEventTypeSchema,
  severity: LifeEventSeveritySchema.default('medium'),
  /** Description libre (max 500 chars) */
  description: z.string().max(500),
  /** Zones d'impact estimées par l'user (sommeil, alimentation, training, mental) */
  expected_impact_areas: z.array(z.enum(['sleep', 'eating', 'training', 'mental', 'social', 'energy'])).default([]),
  /** Server timestamp */
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type LifeEvent = z.infer<typeof LifeEventSchema>;

/**
 * Détermine si un événement est ACTIF aujourd'hui (date_start <= today
 * ET (date_end absent OR date_end >= today)).
 */
export function isEventActive(event: LifeEvent, todayIso?: string): boolean {
  const today = todayIso ?? new Date().toISOString().slice(0, 10);
  if (event.date_start > today) return false;
  if (event.date_end && event.date_end < today) return false;
  return true;
}
