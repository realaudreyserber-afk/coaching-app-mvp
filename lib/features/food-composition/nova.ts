/**
 * Classification NOVA (degré de transformation) — heuristique conservatrice.
 *
 * Cadre : la classification NOVA distingue les aliments ULTRA-TRANSFORMÉS (AUT,
 * NOVA 4) du reste. Les cohortes (NutriNet-Santé, INSERM/INRAE) associent une
 * forte consommation d'AUT à un sur-risque (surpoids, DT2, MCV, mortalité) qui
 * PERSISTE après ajustement sur calories/sel/sucre → la transformation elle-même
 * compte (matrice alimentaire dégradée, additifs, satiété moindre, ingestion rapide).
 *
 * Pour un sportif : les aliments bruts à forte densité protéique / faible densité
 * énergétique maximisent la satiété PAR calorie → rendent un déficit tenable ;
 * les AUT font l'inverse (beaucoup de calories, peu de satiété, faim précoce).
 *
 * NUANCE (importante) : "transformé" n'est pas binaire. Cuire / fermenter /
 * mettre en conserve nature = transformation MINEURE, neutre ou bénéfique
 * (yaourt nature, pain au levain, légumineuses en conserve). On ne diabolise
 * PAS : c'est le DEGRÉ et la FRÉQUENCE qui comptent, pas la "pureté".
 *
 * ⚠️ Heuristique (mots-clés + groupe CIQUAL), pas une analyse d'ingrédients.
 * Conservatrice : ne flague AUT que sur signaux FORTS (sinon "peu transformé").
 */

export type NovaGroup = 1 | 2 | 3 | 4;

export interface TransformationClass {
  nova: NovaGroup;
  ultra_processed: boolean; // nova === 4
  label_fr: string;
}

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Construit une regex de mots entiers (évite "pané" vs "panais") avec pluriel optionnel.
function wordsRe(keywords: string[]): RegExp {
  const alt = keywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return new RegExp(`\\b(?:${alt})s?\\b`);
}

// NOVA 4 — ultra-transformation (formulations industrielles).
const AUT_RE = wordsRe([
  'nugget', 'croquette', 'cordon bleu', 'pane', 'panee', 'panure', 'chapelure',
  'biscuit', 'gateau', 'viennoiserie', 'brioche', 'croissant', 'beignet', 'gaufre',
  'bonbon', 'confiserie', 'chewing', 'marshmallow', 'nougat', 'dragee',
  'chips', 'soda', 'cola', 'limonade', 'energisant', 'energy drink',
  'nappage', 'fourre', 'fourree', 'creme dessert', 'dessert lacte', 'flan',
  'knacki', 'surimi', 'quenelle', 'pizza', 'hamburger', 'hot dog', 'kebab',
  'nesquik', 'nutella', 'pate a tartiner', 'cereales petit dejeuner', 'petales',
  'barre chocolatee', 'barre cerealiere', 'barre patissiere', 'barre glacee',
  'sirop de glucose', 'plat cuisine', 'plat prepare', 'nectar',
]);
const AUT_GROUPS = ['glaces et sorbets'];

// NOVA 2 — ingrédients culinaires.
const CULINARY_RE = wordsRe(['huile', 'beurre', 'margarine', 'saindoux', 'farine', 'fecule', 'maizena']);

// NOVA 3 — transformé (procédés simples + sel/sucre/fermentation).
const PROCESSED_RE = wordsRe([
  'pain', 'fromage', 'jambon', 'lardon', 'bacon', 'saucisse', 'saucisson',
  'charcuterie', 'fume', 'fumee', 'conserve', 'sardine', 'olive', 'cornichon',
  'levain', 'feta', 'mozzarella', 'compote',
]);

export function classifyTransformation(name: string, group = ''): TransformationClass {
  const n = norm(name);
  const g = norm(group);

  if (AUT_GROUPS.some((x) => g.includes(norm(x))) || AUT_RE.test(n)) {
    return { nova: 4, ultra_processed: true, label_fr: 'ultra-transformé (AUT)' };
  }
  if (CULINARY_RE.test(n)) {
    return { nova: 2, ultra_processed: false, label_fr: 'ingrédient culinaire' };
  }
  if (PROCESSED_RE.test(n)) {
    return { nova: 3, ultra_processed: false, label_fr: 'transformé' };
  }
  return { nova: 1, ultra_processed: false, label_fr: 'brut / peu transformé' };
}

/**
 * Densité nutritionnelle utile au coaching (cut = satiété PAR calorie).
 * `protein_per_100kcal` élevé + `kcal_per_100g` faible = aliment "rassasiant".
 */
export function densityMetrics(per100g: Record<string, number>): {
  kcal_per_100g: number | null;
  protein_per_100kcal: number | null;
} {
  const kcal = typeof per100g.kcal === 'number' ? per100g.kcal : null;
  const protein = typeof per100g.protein_g === 'number' ? per100g.protein_g : null;
  return {
    kcal_per_100g: kcal,
    protein_per_100kcal:
      kcal && kcal > 0 && protein != null ? Math.round((protein / kcal) * 100 * 10) / 10 : null,
  };
}
