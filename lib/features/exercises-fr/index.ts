/**
 * Bibliothèque d'exercices FR (source : docteur-fitness.com, usage référence).
 *
 * 482 exercices avec nom FR, catégorie (groupe musculaire / type), image locale
 * (public/exercices/) et texte d'exécution ("how_to"). Alimente la page
 * /exercices-musculation. Complémentaire de `exercise-db` (Functional Fitness,
 * EN-canonique, utilisée par l'agent training).
 */

import 'server-only';

/* eslint-disable @typescript-eslint/no-require-imports */
export interface ExerciseFr {
  name: string;
  category: string;
  slug: string;
  url: string;
  /** Photo statique (poster) — servie depuis public/exercices/. Utilisée en grille. */
  image: string | null;
  /** GIF animé de démonstration du mouvement — servi depuis public/exercices/. */
  gif: string | null;
  /** Réalisable à la maison : aucun équipement de salle requis (poids du corps,
   *  haltères, élastiques, banc, kettlebell… OK ; barre/machine/poulie = non). */
  home: boolean;
  meta_description: string;
  how_to: string;
}

const ALL = require('./data/exercices.json') as ExerciseFr[];

/** Version allégée (sans how_to) pour la grille — bundle client léger. */
export interface ExerciseFrLite {
  name: string;
  category: string;
  slug: string;
  image: string | null;
  /** Réalisable à la maison (sans équipement de salle). */
  home: boolean;
}

// Muscu d'abord, puis cardio / mobilité / yoga.
const CATEGORY_ORDER = [
  'quadriceps', 'ischio-jambiers', 'fessiers', 'mollets', 'pectoraux', 'dos',
  'épaules', 'biceps', 'triceps', 'abdominaux',
  'cardio-training', 'étirements et mobilité', 'postures de yoga',
];
function catRank(c: string): number {
  const i = CATEGORY_ORDER.indexOf(c);
  return i < 0 ? 99 : i;
}

export function getAllExercisesFr(): ExerciseFr[] {
  return ALL;
}

export function getExercisesFrLite(): ExerciseFrLite[] {
  return ALL
    .map((e) => ({ name: e.name, category: e.category, slug: e.slug, image: e.image, home: e.home }))
    .sort((a, b) => catRank(a.category) - catRank(b.category) || a.name.localeCompare(b.name));
}

/** Nombre d'exercices réalisables à la maison (sans équipement de salle). */
export function exerciseFrHomeCount(): number {
  return ALL.filter((e) => e.home).length;
}

export function getExerciseFrBySlug(slug: string): ExerciseFr | null {
  return ALL.find((e) => e.slug === slug) ?? null;
}

export function exerciseFrCategories(): Array<{ category: string; count: number }> {
  const m: Record<string, number> = {};
  for (const e of ALL) m[e.category] = (m[e.category] || 0) + 1;
  return Object.entries(m)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => catRank(a.category) - catRank(b.category) || a.category.localeCompare(b.category));
}

export function exerciseFrCount(): number {
  return ALL.length;
}
