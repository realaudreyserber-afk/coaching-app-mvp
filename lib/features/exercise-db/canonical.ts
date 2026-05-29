/**
 * Match CANONIQUE FR → bibliothèque d'exercices.
 *
 * Problème résolu : la base Functional Fitness est riche en VARIANTES mais le
 * mouvement "propre" est noyé ("squat" → "Squat Jump miniband"). Ici on mappe
 * les exercices mainstream FR (style docteur-fitness : pompe, développé couché,
 * squat, soulevé de terre…) vers la version la PLUS PROPRE de la base, via un
 * scoring de propreté (pénalise variantes/exotique : alternating, single arm,
 * jump, tempo, pneu… ; privilégie l'équipement attendu + le nom court).
 *
 * Les exercices SUR MACHINE absents de la base free-weight (leg press, leg curl,
 * leg extension, front squat) ont un fallback hand-authored → le socle reste
 * cohérent et complet pour un coach de recomposition.
 */

import 'server-only';
import type { Exercise, ExerciseLevel } from './index';

/* eslint-disable @typescript-eslint/no-require-imports */
const RAW = require('./data/exercises.json') as Array<
  Exercise & { region?: string | null; explain_url?: string | null }
>;

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}

// Tokens qui trahissent une VARIANTE/exotisme (à éviter pour le mouvement de base).
const COMPLEX = [
  'alternating', 'single arm', 'single leg', 'miniband', 'superband', 'suspension',
  'tempo', 'eccentric', 'paused', 'deficit', 'jump', 'tire', 'pneu', 'rotational',
  'kneeling', 'prone', 'supine', 'top down', 'archer', 'staggered', 'b stance',
  'deadstop', '1.5', 'cluster', 'sliding', 'slider', 'jerk', 'clean', 'snatch',
  'pistol', 'cossack', 'zercher', 'anderson', 'typewriter', 'handstand', 'pike',
  'lever', 'tuck', 'copenhagen', 'battle', 'around the world', 'half kneeling',
];

interface CanonEntry {
  /** Nom canonique FR (affiché) */
  fr: string;
  /** Alias FR pour matcher une requête (normalisés) */
  aliases: string[];
  /** Mots-clés EN à chercher dans la base (au moins un) */
  keywords: string[];
  /** Mots-clés EN à EXCLURE (variantes indésirables) */
  exclude?: string[];
  /** Équipement préféré (slug) — bonus de score */
  prefer?: string;
  /** Fallback hand-authored si rien de propre en base (ex: machines absentes) */
  fallback?: Exercise;
}

function fb(p: Partial<Exercise> & { name: string; name_fr: string }): Exercise {
  return {
    name: p.name,
    name_fr: p.name_fr,
    family: p.family ?? null,
    level: p.level ?? 'intermediaire',
    muscle: p.muscle ?? null,
    equipment: p.equipment ?? null,
    pattern: p.pattern ?? null,
    mechanics: p.mechanics ?? 'compose',
    unilateral: p.unilateral ?? false,
    demo_url: p.demo_url ?? null,
  };
}

export const CANONICAL_FR: CanonEntry[] = [
  // Pectoraux
  { fr: 'Pompe', aliases: ['pompe', 'pompes', 'push up'], keywords: ['push up', 'pushup'], exclude: ['incline', 'decline', 'planche', 'pseudo', 'hindu'], prefer: 'aucun' },
  { fr: 'Développé couché', aliases: ['developpe couche', 'bench press'], keywords: ['bench press'], exclude: ['incline', 'decline', 'floor', 'close grip'], prefer: 'barre' },
  { fr: 'Développé incliné', aliases: ['developpe incline'], keywords: ['incline bench press'], prefer: 'barre' },
  { fr: 'Dips', aliases: ['dips', 'dip'], keywords: ['dip'], exclude: ['bench dip', 'tricep'], prefer: 'aucun' },
  // Dos
  { fr: 'Tractions (pronation)', aliases: ['traction', 'tractions', 'pull up'], keywords: ['pull up', 'pullup'], exclude: ['scapular', 'commando', 'archer', 'l sit', 'around'], prefer: 'barre_traction' },
  { fr: 'Tractions (supination)', aliases: ['traction supination', 'chin up'], keywords: ['chin up', 'chinup'], prefer: 'barre_traction' },
  { fr: 'Tirage vertical', aliases: ['tirage vertical', 'lat pulldown', 'tirage poulie haute'], keywords: ['lat pulldown', 'pulldown'], prefer: 'poulie' },
  { fr: 'Rowing barre', aliases: ['rowing barre', 'rowing', 'barbell row', 'bent over row'], keywords: ['bent over row', 'barbell row', 'pendlay'], prefer: 'barre' },
  { fr: 'Rowing haltère', aliases: ['rowing haltere', 'dumbbell row'], keywords: ['dumbbell row', 'dumbbell bent over row'], prefer: 'halteres' },
  { fr: 'Tirage horizontal (poulie)', aliases: ['tirage horizontal', 'seated row', 'rowing assis'], keywords: ['seated cable row', 'cable row'], prefer: 'poulie', fallback: fb({ name: 'Seated Cable Row', name_fr: 'Tirage horizontal à la poulie', family: 'pull', muscle: 'dos', equipment: 'poulie', pattern: 'tirage_horizontal' }) },
  // Épaules
  { fr: 'Développé militaire', aliases: ['developpe militaire', 'overhead press', 'military press', 'presse a epaules'], keywords: ['overhead press', 'military press', 'strict press'], exclude: ['push press', 'z press', 'landmine', 'arnold'], prefer: 'barre' },
  { fr: 'Élévations latérales', aliases: ['elevations laterales', 'elevation laterale', 'lateral raise'], keywords: ['lateral raise'], exclude: ['prone', 'incline', 'leaning'], prefer: 'halteres' },
  // Bras
  { fr: 'Curl biceps', aliases: ['curl biceps', 'curl', 'bicep curl'], keywords: ['bicep curl', 'biceps curl'], exclude: ['spider', 'preacher', 'concentration', 'zottman', 'drag'], prefer: 'barre' },
  { fr: 'Extension triceps', aliases: ['extension triceps', 'tricep extension', 'pushdown'], keywords: ['tricep pushdown', 'triceps pushdown', 'tricep extension', 'overhead tricep'], prefer: 'poulie' },
  // Jambes
  { fr: 'Squat (barre, dos)', aliases: ['squat', 'back squat', 'squat barre'], keywords: ['back squat', 'barbell squat'], exclude: ['front', 'jerk', 'overhead', 'zercher', 'split', 'jump', 'box', 'anderson', 'pause', 'sumo', 'pistol'], prefer: 'barre' },
  { fr: 'Front squat', aliases: ['front squat', 'squat avant'], keywords: ['front squat'], prefer: 'barre', fallback: fb({ name: 'Barbell Front Squat', name_fr: 'Front squat (barre)', family: 'squat', muscle: 'quadriceps', equipment: 'barre', pattern: 'squat' }) },
  { fr: 'Squat gobelet', aliases: ['squat gobelet', 'goblet squat'], keywords: ['goblet squat'], prefer: 'halteres' },
  { fr: 'Fente', aliases: ['fente', 'fentes', 'lunge'], keywords: ['forward lunge', 'lunge'], exclude: ['curtsy', 'lateral', 'jump', 'walking', 'deficit'], prefer: 'aucun' },
  { fr: 'Presse à cuisse', aliases: ['presse a cuisse', 'leg press'], keywords: ['leg press'], exclude: ['tire', 'pneu', 'single'], prefer: 'machine', fallback: fb({ name: 'Leg Press', name_fr: 'Presse à cuisse (machine)', family: 'squat', muscle: 'quadriceps', equipment: 'machine', pattern: 'squat' }) },
  { fr: 'Soulevé de terre', aliases: ['souleve de terre', 'deadlift'], keywords: ['conventional deadlift', 'barbell deadlift', 'deadlift'], exclude: ['romanian', 'stiff', 'suitcase', 'single', 'deficit', 'jefferson', 'sumo', 'snatch grip', 'trap bar', 'dumbbell', 'kettlebell'], prefer: 'barre' },
  { fr: 'Soulevé de terre roumain', aliases: ['souleve de terre roumain', 'romanian deadlift', 'rdl'], keywords: ['romanian deadlift'], exclude: ['single', 'dumbbell', 'b stance'], prefer: 'barre' },
  { fr: 'Hip thrust', aliases: ['hip thrust', 'pont fessier charge'], keywords: ['hip thrust'], exclude: ['single', 'b stance', 'march'], prefer: 'barre' },
  { fr: 'Leg curl (ischio)', aliases: ['leg curl', 'curl ischio', 'flexion jambes'], keywords: ['leg curl', 'hamstring curl', 'nordic'], exclude: ['reverse nordic'], prefer: 'machine', fallback: fb({ name: 'Lying Leg Curl', name_fr: 'Leg curl allongé (machine)', family: 'hinge', muscle: 'ischio_jambiers', equipment: 'machine', pattern: 'flexion_genou' }) },
  { fr: 'Leg extension (quadriceps)', aliases: ['leg extension', 'extension jambes'], keywords: ['leg extension'], exclude: ['single', 'alternating', 'lever', 'bridge'], prefer: 'machine', fallback: fb({ name: 'Leg Extension', name_fr: 'Leg extension (machine)', family: 'squat', muscle: 'quadriceps', equipment: 'machine', pattern: 'extension_genou', mechanics: 'isolation' }) },
  { fr: 'Extension mollets', aliases: ['extension mollets', 'mollets', 'calf raise'], keywords: ['calf raise'], prefer: 'aucun' },
  // Tronc
  { fr: 'Crunch', aliases: ['crunch', 'crunchs'], keywords: ['crunch'], exclude: ['reverse', 'bicycle', 'cable', 'oblique'], prefer: 'aucun' },
  { fr: 'Relevé de jambes', aliases: ['releve de jambes', 'releves de jambes', 'leg raise'], keywords: ['hanging leg raise', 'hanging knee raise', 'leg raise'], exclude: ['single', 'supine alternating'], prefer: 'barre_traction' },
  { fr: 'Planche / gainage', aliases: ['planche', 'gainage', 'plank'], keywords: ['forearm plank', 'plank'], exclude: ['side', 'copenhagen', 'kneeling', 'hip abduction', 'reach', 'walkout'], prefer: 'aucun' },
];

function scoreClean(ex: Exercise, prefer?: string): number {
  const n = norm(ex.name);
  let s = -n.split(' ').length;
  for (const c of COMPLEX) if (n.includes(c)) s -= 4;
  if (prefer && ex.equipment === prefer) s += 6;
  if (ex.equipment === 'aucun' && !prefer) s += 1;
  return s;
}

/** Résout une entrée canonique vers l'exercice le PLUS PROPRE de la base (ou son fallback). */
export function resolveCanonical(entry: CanonEntry): Exercise | null {
  let best: { ex: Exercise; sc: number } | null = null;
  for (const r of RAW) {
    const n = norm(r.name);
    if (!entry.keywords.some((k) => n.includes(norm(k)))) continue;
    if (entry.exclude && entry.exclude.some((k) => n.includes(norm(k)))) continue;
    const sc = scoreClean(r, entry.prefer);
    if (!best || sc > best.sc) best = { ex: r, sc };
  }
  if (best) return { ...best.ex, name_fr: entry.fr }; // nom FR canonique propre
  return entry.fallback ?? null;
}

/** Mappe une requête FR libre (ex: "pompe", "développé couché") vers l'exercice canonique propre. */
export function matchFrExercise(query: string): Exercise | null {
  const q = norm(query);
  if (q.length < 3) return null;
  let hit: CanonEntry | null = null;
  let hitLen = 0;
  for (const e of CANONICAL_FR) {
    for (const a of e.aliases) {
      const na = norm(a);
      // La requête CONTIENT l'alias (ex: "je fais des pompes" -> "pompe").
      // On garde l'alias le plus LONG (le plus spécifique) → "squat gobelet"
      // l'emporte sur "squat" quand les deux sont présents.
      if (q.includes(na) && na.length > hitLen) {
        hit = e;
        hitLen = na.length;
      }
    }
  }
  return hit ? resolveCanonical(hit) : null;
}

/** Le socle canonique complet (chaque mouvement mainstream → version propre). */
export function canonicalSocle(): Exercise[] {
  return CANONICAL_FR.map(resolveCanonical).filter((x): x is Exercise => x !== null);
}
