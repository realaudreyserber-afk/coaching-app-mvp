/**
 * Bibliothèque d'EXERCICES — Functional Fitness Exercise Database v2.9.
 *
 * 3240 exercices avec NIVEAU (débutant/intermédiaire/avancé), muscle cible,
 * équipement, pattern de mouvement, mécanique (composé/isolation), latéralité.
 * Importé via scripts/import-exercises.py (xlsx) + traductions FR.
 *
 * Récupération DÉTERMINISTE par filtres (niveau + équipement + muscle + pattern)
 * — complémentaire du RAG embeddings (rag-coach) : pour "donne-moi des exercices
 * fessiers débutant au poids du corps", un filtre structuré est plus fiable
 * qu'une similarité vectorielle.
 *
 * Source : Functional Fitness Exercise Database v2.9 (Jensen Van Diepen).
 */

import 'server-only';

/* eslint-disable @typescript-eslint/no-require-imports */
interface RawEx {
  name: string;
  name_fr: string;
  family: string | null;
  level: string;
  muscle: string | null;
  equipment: string | null;
  pattern: string | null;
  mechanics: string | null;
  unilateral: boolean;
  region: string | null;
  demo_url: string | null;
  explain_url: string | null;
}
const RAW = require('./data/exercises.json') as RawEx[];

export type ExerciseLevel = 'debutant' | 'intermediaire' | 'avance';

export interface Exercise {
  name: string; // nom EN (canonique)
  name_fr: string;
  /** Famille de pattern : push / pull / squat / hinge / core / autres */
  family: string | null;
  level: ExerciseLevel;
  muscle: string | null;
  equipment: string | null;
  pattern: string | null;
  mechanics: string | null;
  unilateral: boolean;
  /** Lien démo YouTube (si dispo) */
  demo_url: string | null;
}

const LEVEL_ORDER: Record<string, number> = { debutant: 1, intermediaire: 2, avance: 3 };

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}
function toEx(r: RawEx): Exercise {
  return {
    name: r.name,
    name_fr: r.name_fr,
    family: r.family,
    level: (r.level as ExerciseLevel) ?? 'intermediaire',
    muscle: r.muscle,
    equipment: r.equipment,
    pattern: r.pattern,
    mechanics: r.mechanics,
    unilateral: r.unilateral,
    demo_url: r.demo_url,
  };
}

export interface ExerciseFilter {
  /** Inclut les exercices de ce niveau ET en dessous (comme le RAG). */
  maxLevel?: ExerciseLevel;
  /** Famille : push / pull / squat / hinge / core / autres (match exact). */
  family?: string;
  /** Slugs d'équipement disponibles ; le poids du corps ("aucun") est toujours autorisé. */
  equipment?: string[];
  /** Muscle cible (slug FR : fessiers, quadriceps, dos…) — match partiel. */
  muscle?: string;
  /** Pattern de mouvement (slug FR fin : flexion_de_hanche…) — match partiel. */
  pattern?: string;
}

/**
 * Filtre la bibliothèque. Tous les critères sont optionnels (ET logique).
 * Sans `equipment`, aucun filtre matériel. Avec, on garde le poids du corps +
 * les exercices dont l'équipement est dans la liste.
 */
export function searchExercises(filter: ExerciseFilter = {}, limit = 12): Exercise[] {
  const maxLvl = filter.maxLevel ? LEVEL_ORDER[filter.maxLevel] : 3;
  const family = filter.family ? norm(filter.family) : null;
  const equip =
    filter.equipment && filter.equipment.length ? new Set(filter.equipment.map(norm)) : null;
  const muscle = filter.muscle ? norm(filter.muscle) : null;
  const pattern = filter.pattern ? norm(filter.pattern) : null;

  const out: Exercise[] = [];
  for (const r of RAW) {
    if ((LEVEL_ORDER[r.level] ?? 2) > maxLvl) continue;
    if (family && (!r.family || norm(r.family) !== family)) continue;
    if (equip && r.equipment && r.equipment !== 'aucun' && !equip.has(norm(r.equipment))) continue;
    if (muscle && (!r.muscle || !norm(r.muscle).includes(muscle))) continue;
    if (pattern && (!r.pattern || !norm(r.pattern).includes(pattern))) continue;
    out.push(toEx(r));
    if (out.length >= limit) break;
  }
  return out;
}

export function exerciseCount(): number {
  return RAW.length;
}
