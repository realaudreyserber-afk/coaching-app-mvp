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
    .replace(/œ/g, 'oe') // ligatures FR (œuf, bœuf, cœur…)
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // diacritiques combinants
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Mots vides FR + marqueurs d'état non discriminants (matching robuste).
const STOP_WORDS = new Set([
  'au', 'aux', 'de', 'des', 'du', 'la', 'le', 'les', 'et', 'en', 'a',
  'sans', 'avec', 'ou', 'sur', 'cru', 'crue', 'nature',
]);

/** Retire les pluriels simples (amandes -> amande). */
function stem(t: string): string {
  return t.length >= 4 && t.endsWith('s') ? t.slice(0, -1) : t;
}
function tokenize(norm: string): string[] {
  return norm
    .split(' ')
    .map(stem)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

// Index construit une fois au chargement (module serveur, ~3.5k entrées).
const BY_CODE = new Map<string, RawFood>();
interface IndexEntry {
  raw: RawFood;
  norm: string;
  head: string;
  tokens: Set<string>;
  nTok: number;
}
const INDEX: IndexEntry[] = [];
for (const r of RAW) {
  BY_CODE.set(r.c, r);
  const norm = normalize(r.n);
  const toks = tokenize(norm);
  INDEX.push({ raw: r, norm, head: toks[0] ?? '', tokens: new Set(toks), nTok: toks.length });
}

export function getFoodByCode(code: string): FoodComposition | null {
  const r = BY_CODE.get(String(code).trim());
  return r ? toFood(r) : null;
}

export interface FoodSearchHit extends FoodComposition {
  /** Score de pertinence (plus haut = meilleur) */
  score: number;
  /** Part des tokens de la requête couverts par l'aliment (0-1) */
  coverage: number;
}

/** Seuils d'acceptation d'un match FIABLE (cf. matchFood). */
export const MATCH_MIN_SCORE = 4;
export const MATCH_MIN_COVERAGE = 0.6;

/**
 * Recherche d'aliments par nom (tolérante accents/casse/pluriels).
 *
 * Le scoring favorise l'aliment qui "EST" la requête (head-token) et pénalise
 * les plats composés (tokens en trop) — pour ne pas matcher "amandes" ->
 * "Croissant aux amandes". `coverage` = part des tokens de la requête réellement
 * présents ; il sert à REJETER (via matchFood) les produits transformés / de
 * marque sans équivalent CIQUAL plutôt que de retomber sur un mauvais aliment
 * brut — la justesse nutritionnelle dépend du niveau de transformation
 * (blanc de poulet ≠ nuggets, cacao ≠ Nesquik).
 */
export function searchFoods(query: string, limit = 8): FoodSearchHit[] {
  const nq = normalize(query);
  const qTokens = tokenize(nq);
  if (qTokens.length === 0) return [];

  const hits: FoodSearchHit[] = [];
  for (const e of INDEX) {
    let overlap = 0;
    for (const t of qTokens) if (e.tokens.has(t)) overlap++;
    const sub = nq.length >= 3 && e.norm.includes(nq);
    if (overlap === 0 && !sub) continue;

    const coverage = overlap / qTokens.length;
    let score = overlap * 2 + coverage * 3;
    if (e.norm === nq) score += 10;
    else if (e.norm.startsWith(nq)) score += 3;
    if (e.head && qTokens.includes(e.head)) score += 3; // l'aliment "est" un mot de la requête
    score -= Math.max(0, e.nTok - qTokens.length) * 0.4; // préfère les aliments simples

    hits.push({
      ...toFood(e.raw),
      score: Math.round(score * 100) / 100,
      coverage: Math.round(coverage * 100) / 100,
    });
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit);
}

/**
 * Meilleur match FIABLE pour un aliment loggé (texte libre), ou null si le top
 * est sous les seuils (score + couverture). On PRÉFÈRE "non identifié" à un
 * mauvais match : un produit transformé/de marque sans équivalent CIQUAL ne doit
 * JAMAIS être assimilé à l'aliment brut (composition très différente).
 */
export function matchFood(query: string): FoodComposition | null {
  const [top] = searchFoods(query, 1);
  if (!top || top.score < MATCH_MIN_SCORE || top.coverage < MATCH_MIN_COVERAGE) {
    return null;
  }
  return { code: top.code, name: top.name, group: top.group, per100g: top.per100g };
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
