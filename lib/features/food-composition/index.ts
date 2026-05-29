/**
 * Table de composition des aliments — CIQUAL 2025 (ANSES).
 *
 * 3484 aliments × jusqu'à 35 nutriments (macros + micros) pour 100 g.
 * Données importées depuis les XML CIQUAL via scripts/import-ciqual.mjs.
 * Source : Table Ciqual 2025, ANSES — doi 10.57745/RDMHWY.
 *
 * C'est LA source qui débloque la composition par aliment (combien de fer dans
 * 100 g de lentilles) → détection de carence réelle. Complète nutrition-db
 * (qui donne les CIBLES/AJR) : ici on a les APPORTS.
 *
 * Clés de `per100g` alignées sur nutrition-db + DailyMicroIntake.
 */

import 'server-only';

/* eslint-disable @typescript-eslint/no-require-imports */
interface RawFood {
  c: string;
  n: string;
  g: string;
  v: Record<string, number>;
}
const RAW = require('./data/ciqual-foods.json') as RawFood[];

export interface FoodComposition {
  /** Code CIQUAL */
  code: string;
  /** Nom français */
  name: string;
  /** Groupe alimentaire CIQUAL */
  group: string;
  /** Teneurs pour 100 g (clés : kcal, protein_g, iron_mg, vit_b12_mcg, …) */
  per100g: Record<string, number>;
}

function toFood(r: RawFood): FoodComposition {
  return { code: r.c, name: r.n, group: r.g, per100g: r.v };
}

/** Normalise pour recherche : minuscules, sans accents, sans ponctuation. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // diacritiques combinants
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Index construits une fois au chargement (module serveur, ~3.5k entrées).
const BY_CODE = new Map<string, RawFood>();
const NORM: Array<{ raw: RawFood; norm: string; tokens: Set<string> }> = [];
for (const r of RAW) {
  BY_CODE.set(r.c, r);
  const norm = normalize(r.n);
  NORM.push({ raw: r, norm, tokens: new Set(norm.split(' ').filter(Boolean)) });
}

export function getFoodByCode(code: string): FoodComposition | null {
  const r = BY_CODE.get(String(code).trim());
  return r ? toFood(r) : null;
}

export interface FoodSearchHit extends FoodComposition {
  /** Score de pertinence (plus haut = meilleur match) */
  score: number;
}

/**
 * Recherche d'aliments par nom (tolérante aux accents/casse). Score :
 *  - +3 si le nom normalisé contient la requête entière
 *  - +1 par token de la requête présent dans le nom
 *  - bonus si le match est en début de nom (aliment générique)
 * Sert à mapper un aliment loggé (texte libre) vers sa composition CIQUAL.
 */
export function searchFoods(query: string, limit = 8): FoodSearchHit[] {
  const q = normalize(query);
  if (q.length < 2) return [];
  const qTokens = q.split(' ').filter(Boolean);

  const hits: FoodSearchHit[] = [];
  for (const entry of NORM) {
    let score = 0;
    if (entry.norm.includes(q)) score += 3;
    if (entry.norm.startsWith(q)) score += 2;
    for (const t of qTokens) {
      if (entry.tokens.has(t)) score += 1;
      else if (t.length >= 4 && entry.norm.includes(t)) score += 0.5;
    }
    if (score > 0) {
      // Préfère les noms courts (aliments génériques) à pertinence égale
      score += Math.max(0, 1 - entry.norm.length / 120);
      hits.push({ ...toFood(entry.raw), score: Math.round(score * 100) / 100 });
    }
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit);
}

/** Meilleur match unique pour un nom d'aliment loggé (ou null). */
export function matchFood(query: string): FoodComposition | null {
  const [top] = searchFoods(query, 1);
  return top ?? null;
}

/** Teneurs pour une portion en grammes (scale per100g × g/100). */
export function nutrientsForPortion(
  food: FoodComposition,
  grams: number,
): Record<string, number> {
  const factor = grams / 100;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(food.per100g)) {
    out[k] = Math.round(v * factor * 1000) / 1000;
  }
  return out;
}

/** Nombre d'aliments dans la table (observabilité / health-check). */
export function foodCount(): number {
  return RAW.length;
}
