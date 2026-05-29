/**
 * Table d'INDEX GLYCÉMIQUE (IG) + calcul de CHARGE GLYCÉMIQUE (CG) — NoDream.
 *
 * Source des valeurs : consensus des "International Tables of Glycemic Index and
 * Glycemic Load Values 2021" (Atkinson FS, Brand-Miller JC, Foster-Powell K,
 * Buyken AE, Goletzke J — Am J Clin Nutr 2021, méthodo ISO 26642) + GI Foundation
 * (glycemicindex.com). Référence = glucose (IG 100).
 *
 * ⚠️ L'IG d'un aliment a une VARIANCE réelle (variété, maturité, cuisson, étude).
 * Ce sont des valeurs INDICATIVES, pas des constantes. Et — rappel — l'IG est
 * souvent SURVENDU : raisonner en CG (= IG × glucides de la portion / 100) et en
 * degré de transformation, pas en IG nu. CIQUAL ne contient PAS l'IG (propriété
 * mesurée séparément) → cette table comble ce manque, la CG se calcule en
 * combinant cet IG avec les glucides CIQUAL de la portion.
 */

export type GiCategory = 'bas' | 'moyen' | 'eleve';
export type GlCategory = 'basse' | 'moderee' | 'elevee';

export interface GiEntry {
  key: string;
  name_fr: string;
  /** IG, référence glucose = 100 */
  gi: number;
  /** Mots-clés normalisés (minuscule, sans accent) pour rattacher un aliment loggé */
  match: string[];
}

/** IG : bas < 55, moyen 55-70, élevé > 70. */
export function giCategory(gi: number): GiCategory {
  if (gi < 55) return 'bas';
  if (gi <= 70) return 'moyen';
  return 'eleve';
}

/** CG d'une portion : basse < 10, modérée 10-19, élevée ≥ 20. */
export function glCategory(gl: number): GlCategory {
  if (gl < 10) return 'basse';
  if (gl < 20) return 'moderee';
  return 'elevee';
}

/** Charge glycémique = IG × glucides (g) de la portion / 100. */
export function glycemicLoad(gi: number, carbsGramsPortion: number): number {
  return Math.round((gi * carbsGramsPortion) / 100);
}

export const GI_TABLE: GiEntry[] = [
  // ── Pains & céréales ──
  { key: 'baguette', name_fr: 'Baguette / pain blanc', gi: 95, match: ['baguette', 'pain blanc', 'pain de mie', 'pain courant'] },
  { key: 'pain_complet', name_fr: 'Pain complet', gi: 65, match: ['pain complet', 'pain integral'] },
  { key: 'pain_levain', name_fr: 'Pain au levain', gi: 54, match: ['levain'] },
  { key: 'pain_seigle', name_fr: 'Pain de seigle', gi: 50, match: ['seigle', 'pain noir'] },
  { key: 'biscotte', name_fr: 'Biscotte', gi: 68, match: ['biscotte'] },
  { key: 'cornflakes', name_fr: 'Corn flakes', gi: 81, match: ['corn flakes', 'cornflakes', 'petales de mais'] },
  { key: 'avoine', name_fr: 'Flocons d’avoine', gi: 55, match: ['flocons avoine', 'flocon avoine', 'avoine'] },
  { key: 'avoine_instant', name_fr: 'Avoine instantanée', gi: 79, match: ['avoine instantanee', 'porridge instantane'] },
  { key: 'muesli', name_fr: 'Muesli', gi: 57, match: ['muesli'] },
  { key: 'riz_blanc', name_fr: 'Riz blanc', gi: 73, match: ['riz blanc', 'riz rond', 'riz cuisson rapide'] },
  { key: 'riz_basmati', name_fr: 'Riz basmati', gi: 57, match: ['basmati'] },
  { key: 'riz_complet', name_fr: 'Riz complet', gi: 68, match: ['riz complet', 'riz brun', 'riz semi complet'] },
  { key: 'pates', name_fr: 'Pâtes (al dente)', gi: 49, match: ['pate', 'spaghetti', 'macaroni', 'penne', 'tagliatelle'] },
  { key: 'pates_completes', name_fr: 'Pâtes complètes', gi: 48, match: ['pate complete', 'pate semi complete'] },
  { key: 'quinoa', name_fr: 'Quinoa', gi: 53, match: ['quinoa'] },
  { key: 'boulgour', name_fr: 'Boulgour', gi: 48, match: ['boulgour', 'bulgur'] },
  { key: 'semoule', name_fr: 'Semoule / couscous', gi: 65, match: ['semoule', 'couscous'] },
  { key: 'polenta', name_fr: 'Polenta / maïs', gi: 68, match: ['polenta', 'mais doux'] },
  { key: 'sarrasin', name_fr: 'Sarrasin', gi: 45, match: ['sarrasin', 'kasha'] },
  // ── Féculents / tubercules ──
  { key: 'pdt_bouillie', name_fr: 'Pomme de terre bouillie', gi: 78, match: ['pomme de terre', 'patate', 'pdt'] },
  { key: 'pdt_puree', name_fr: 'Purée de pomme de terre', gi: 87, match: ['puree'] },
  { key: 'frites', name_fr: 'Frites', gi: 63, match: ['frite'] },
  { key: 'patate_douce', name_fr: 'Patate douce', gi: 63, match: ['patate douce', 'pomme de terre douce'] },
  // ── Légumineuses (CG faible) ──
  { key: 'lentilles', name_fr: 'Lentilles', gi: 32, match: ['lentille'] },
  { key: 'pois_chiches', name_fr: 'Pois chiches', gi: 28, match: ['pois chiche'] },
  { key: 'haricots_rouges', name_fr: 'Haricots rouges', gi: 24, match: ['haricot rouge', 'haricots rouges'] },
  { key: 'haricots_blancs', name_fr: 'Haricots blancs', gi: 31, match: ['haricot blanc', 'haricots blancs', 'flageolet'] },
  { key: 'pois_casses', name_fr: 'Pois cassés', gi: 25, match: ['pois casse'] },
  { key: 'soja', name_fr: 'Soja / edamame', gi: 16, match: ['soja', 'edamame'] },
  // ── Fruits ──
  { key: 'pomme', name_fr: 'Pomme', gi: 36, match: ['pomme'] },
  { key: 'poire', name_fr: 'Poire', gi: 38, match: ['poire'] },
  { key: 'banane', name_fr: 'Banane', gi: 51, match: ['banane'] },
  { key: 'orange', name_fr: 'Orange', gi: 43, match: ['orange'] },
  { key: 'raisin', name_fr: 'Raisin', gi: 59, match: ['raisin'] },
  { key: 'pasteque', name_fr: 'Pastèque', gi: 72, match: ['pasteque'] },
  { key: 'melon', name_fr: 'Melon', gi: 65, match: ['melon'] },
  { key: 'fraise', name_fr: 'Fraise', gi: 40, match: ['fraise'] },
  { key: 'peche', name_fr: 'Pêche', gi: 42, match: ['peche', 'nectarine'] },
  { key: 'ananas', name_fr: 'Ananas', gi: 59, match: ['ananas'] },
  { key: 'mangue', name_fr: 'Mangue', gi: 51, match: ['mangue'] },
  { key: 'kiwi', name_fr: 'Kiwi', gi: 52, match: ['kiwi'] },
  { key: 'dattes', name_fr: 'Dattes', gi: 55, match: ['datte'] },
  { key: 'pruneaux', name_fr: 'Pruneaux', gi: 29, match: ['pruneau'] },
  { key: 'jus_orange', name_fr: 'Jus d’orange', gi: 50, match: ['jus orange', "jus d orange"] },
  { key: 'jus_pomme', name_fr: 'Jus de pomme', gi: 41, match: ['jus de pomme', 'jus pomme'] },
  // ── Produits laitiers (CG faible) ──
  { key: 'lait', name_fr: 'Lait', gi: 39, match: ['lait demi', 'lait entier', 'lait ecreme', 'lait '] },
  { key: 'yaourt', name_fr: 'Yaourt nature', gi: 36, match: ['yaourt', 'yogourt', 'fromage blanc', 'skyr', 'petit suisse'] },
  { key: 'glace', name_fr: 'Crème glacée', gi: 50, match: ['glace', 'creme glacee'] },
  // ── Sucres & assimilés ──
  { key: 'glucose', name_fr: 'Glucose', gi: 100, match: ['glucose', 'dextrose'] },
  { key: 'sucre', name_fr: 'Sucre (saccharose)', gi: 65, match: ['sucre', 'saccharose'] },
  { key: 'miel', name_fr: 'Miel', gi: 58, match: ['miel'] },
  { key: 'sirop_erable', name_fr: 'Sirop d’érable', gi: 54, match: ['sirop d erable', 'sirop erable'] },
  { key: 'fructose', name_fr: 'Fructose', gi: 15, match: ['fructose'] },
  { key: 'confiture', name_fr: 'Confiture', gi: 65, match: ['confiture'] },
  // ── Snacks / sucrés (attention : "IG bas ≠ sain", cf. chocolat) ──
  { key: 'chocolat_noir', name_fr: 'Chocolat noir', gi: 23, match: ['chocolat noir'] },
  { key: 'chocolat_lait', name_fr: 'Chocolat au lait', gi: 45, match: ['chocolat au lait', 'chocolat lait'] },
  { key: 'pate_tartiner', name_fr: 'Pâte à tartiner', gi: 33, match: ['pate a tartiner', 'nutella'] },
  { key: 'chips', name_fr: 'Chips', gi: 56, match: ['chips'] },
  { key: 'popcorn', name_fr: 'Pop-corn', gi: 65, match: ['pop corn', 'popcorn'] },
  { key: 'soda', name_fr: 'Soda / cola', gi: 63, match: ['soda', 'cola', 'limonade'] },
  // ── Légumes (CG quasi nulle, IG indicatif) ──
  { key: 'carotte_cuite', name_fr: 'Carotte cuite', gi: 39, match: ['carotte cuite'] },
  { key: 'carotte_crue', name_fr: 'Carotte crue', gi: 16, match: ['carotte crue', 'carotte rapee'] },
];

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}

const NORM_TABLE = GI_TABLE.map((e) => ({ e, match: e.match.map(norm) }));

/**
 * Rattache un nom d'aliment (loggé / CIQUAL) à son IG. Renvoie l'entrée dont un
 * mot-clé matche, en préférant le mot-clé le plus spécifique (le plus long).
 * null si aucun IG connu (la CG ne sera alors pas estimée — honnête).
 */
export function findGi(foodName: string): GiEntry | null {
  const n = ` ${norm(foodName)} `;
  let best: { e: GiEntry; len: number } | null = null;
  for (const { e, match } of NORM_TABLE) {
    for (const kw of match) {
      if (n.includes(` ${kw} `) || n.includes(kw)) {
        if (!best || kw.length > best.len) best = { e, len: kw.length };
      }
    }
  }
  return best?.e ?? null;
}

export interface GlycemicEstimate {
  gi: number;
  gi_category: GiCategory;
  /** CG de la portion (si glucides fournis) */
  gl: number | null;
  gl_category: GlCategory | null;
  matched_name: string;
}

/**
 * Estime IG + CG pour un aliment loggé. `carbsGramsPortion` = glucides de la
 * portion (depuis CIQUAL). Renvoie null si l'IG de l'aliment est inconnu.
 */
export function estimateGlycemic(
  foodName: string,
  carbsGramsPortion?: number | null,
): GlycemicEstimate | null {
  const entry = findGi(foodName);
  if (!entry) return null;
  const gl =
    typeof carbsGramsPortion === 'number' && carbsGramsPortion >= 0
      ? glycemicLoad(entry.gi, carbsGramsPortion)
      : null;
  return {
    gi: entry.gi,
    gi_category: giCategory(entry.gi),
    gl,
    gl_category: gl != null ? glCategory(gl) : null,
    matched_name: entry.name_fr,
  };
}
