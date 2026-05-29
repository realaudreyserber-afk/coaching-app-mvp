/**
 * Base de référence des NUTRIMENTS (macros + micros) — NoDream.
 *
 * Sources :
 *  - MSD Manuals (pro), "Revue générale de la nutrition" (rôles, sources,
 *    carences, essentialité, énergie, AG essentiels, fibres, eau).
 *  - Valeurs de référence ANC (ANSES) / RDA (US) / AI (EFSA) pour l'adulte
 *    19-50 ans, là où la page MSD renvoie vers ses tableaux dédiés.
 *
 * ⚠️ CE N'EST PAS un avis médical ni une prescription personnalisée. Ce sont des
 * REPÈRES de population adulte. Les besoins varient (âge, grossesse, pathologie,
 * sport). Le coach s'en sert pour expliquer/orienter, jamais pour diagnostiquer
 * une carence (→ safety / médecin).
 *
 * ⚠️ Ceci est la table des CIBLES + rôles/sources. Elle ne contient PAS la
 * composition par aliment (combien de fer dans 100 g de lentilles). Pour ça il
 * faut une table de composition (recommandé : CIQUAL / ANSES, libre) ; cf.
 * food-composition (à venir). Les clés *_mg/_mcg/_g sont alignées sur
 * DailyMicroIntake (lib/features/micronutrients) pour interop future.
 */

export type NutrientCategory =
  | 'macronutrient'
  | 'vitamin_fat_soluble'
  | 'vitamin_water_soluble'
  | 'mineral_major'
  | 'trace_element'
  | 'other';

export interface NutrientReference {
  /** Clé canonique (alignée DailyMicroIntake quand possible : vit_c_mg, iron_mg…) */
  key: string;
  name_fr: string;
  category: NutrientCategory;
  /** Unité de l'AJR (g, mg, mcg, L, g/kg). */
  unit: string;
  /** Essentiel = non synthétisé par l'organisme, doit venir de l'alimentation. */
  essential: boolean;
  /** AJR/ANC adulte homme 19-50 (null si non quantifié / variable). */
  rda_male: number | null;
  /** AJR/ANC adulte femme 19-50 (null si non quantifié / variable). */
  rda_female: number | null;
  /** Limite supérieure de sécurité (UL) si pertinente — risque de toxicité. */
  upper_limit: number | null;
  /** Énergie (kcal/g) — macronutriments uniquement. */
  energy_kcal_per_g?: number;
  role_fr: string;
  deficiency_fr: string;
  food_sources_fr: string[];
  notes_fr?: string;
}

export const NUTRIENT_REFERENCE: NutrientReference[] = [
  // ───────────────────────── MACRONUTRIMENTS ─────────────────────────
  {
    key: 'protein_g',
    name_fr: 'Protéines',
    category: 'macronutrient',
    unit: 'g/kg',
    essential: true,
    rda_male: 0.8,
    rda_female: 0.8,
    upper_limit: null,
    energy_kcal_per_g: 4,
    role_fr: 'Entretien, réparation et croissance des tissus ; enzymes, hormones, équilibre hydrique.',
    deficiency_fr: 'Fonte musculaire, œdème (kwashiorkor en cas sévère), immunité affaiblie, mauvaise cicatrisation.',
    food_sources_fr: ['œufs', 'viande', 'poisson', 'produits laitiers', 'légumineuses', 'tofu'],
    notes_fr: "ANC base 0,8 g/kg ; 1,4-2,0 g/kg pour croissance musculaire / cut (recoupe le prompt nutrition). Valeur biologique : œuf 100, lait/viande ~90, céréales/légumes ~40.",
  },
  {
    key: 'carb_g',
    name_fr: 'Glucides',
    category: 'macronutrient',
    unit: 'g',
    essential: false,
    rda_male: null,
    rda_female: null,
    upper_limit: null,
    energy_kcal_per_g: 4,
    role_fr: 'Source d’énergie principale (convertis en glucose). Simples (rapides) vs complexes (lents).',
    deficiency_fr: 'Hypoglycémie, cétose, fatigue ; pas de carence stricte (non essentiels) mais impact perf/énergie.',
    food_sources_fr: ['céréales complètes', 'riz', 'pâtes', 'pommes de terre', 'fruits', 'légumineuses'],
    notes_fr: "Pas d'AJR fixe (modulé par l'objectif). Indice glycémique (1-100) = vitesse d'absorption.",
  },
  {
    key: 'fat_g',
    name_fr: 'Lipides',
    category: 'macronutrient',
    unit: 'g',
    essential: false,
    rda_male: null,
    rda_female: null,
    upper_limit: null,
    energy_kcal_per_g: 9,
    role_fr: 'Énergie dense, croissance tissulaire, production hormonale, absorption vitamines liposolubles.',
    deficiency_fr: 'Carence en acides gras essentiels : peau sèche, troubles de croissance, malabsorption.',
    food_sources_fr: ['huiles végétales', 'poissons gras', 'oléagineux', 'avocat', 'œufs'],
    notes_fr: 'Privilégier insaturés ; éviter les acides gras trans. Ratio insaturé/saturé influence le risque CV.',
  },
  {
    key: 'omega6_linoleic_g',
    name_fr: 'Acide linoléique (oméga-6)',
    category: 'macronutrient',
    unit: 'g',
    essential: true,
    rda_male: 17,
    rda_female: 12,
    upper_limit: null,
    role_fr: 'Acide gras essentiel : membranes cellulaires, précurseur de médiateurs.',
    deficiency_fr: 'Dermatite, retard de croissance, mauvaise cicatrisation.',
    food_sources_fr: ['huile de tournesol', 'huile de maïs', 'soja', 'huile de carthame', 'germes de blé'],
  },
  {
    key: 'omega3_ala_g',
    name_fr: 'Acide alpha-linolénique (oméga-3)',
    category: 'macronutrient',
    unit: 'g',
    essential: true,
    rda_male: 1.6,
    rda_female: 1.1,
    upper_limit: null,
    role_fr: 'Acide gras essentiel ; les oméga-3 marins (EPA/DHA) réduisent le risque de coronaropathie.',
    deficiency_fr: 'Troubles neuro-visuels, peau, inflammation.',
    food_sources_fr: ['poissons gras (saumon, maquereau, sardine)', 'lin', 'colza', 'noix', 'soja'],
  },
  {
    key: 'fiber_g',
    name_fr: 'Fibres',
    category: 'macronutrient',
    unit: 'g',
    essential: false,
    rda_male: 38,
    rda_female: 25,
    upper_limit: null,
    role_fr: 'Solubles : baissent glycémie post-prandiale et cholestérol. Insolubles : transit, satiété, volume des selles.',
    deficiency_fr: 'Constipation, glycémie/cholestérol moins bien régulés, satiété moindre.',
    food_sources_fr: ['légumes', 'fruits', 'avoine', 'orge', 'légumineuses', 'céréales complètes'],
    notes_fr: 'Apport très élevé peut réduire l’absorption de certains minéraux.',
  },
  {
    key: 'water_l',
    name_fr: 'Eau',
    category: 'other',
    unit: 'L',
    essential: true,
    rda_male: 3.7,
    rda_female: 2.7,
    upper_limit: null,
    role_fr: 'Solvant, thermorégulation, transport, équilibre hydrique. ~1 mL/kcal dépensée.',
    deficiency_fr: 'Déshydratation : soif, fatigue, baisse de performance, troubles rénaux.',
    food_sources_fr: ['eau', 'boissons', 'fruits et légumes riches en eau'],
    notes_fr: 'Majorer si fièvre, chaleur, TRT (hématocrite), GLP-1 (soif réduite), activité intense.',
  },

  // ─────────────────────── VITAMINES LIPOSOLUBLES ──────────────────────
  {
    key: 'vit_a_mcg',
    name_fr: 'Vitamine A (rétinol / RAE)',
    category: 'vitamin_fat_soluble',
    unit: 'mcg',
    essential: true,
    rda_male: 900,
    rda_female: 700,
    upper_limit: 3000,
    role_fr: 'Vision, intégrité épithéliale, immunité, différenciation cellulaire. Stockée en quantité importante.',
    deficiency_fr: 'Héméralopie (cécité nocturne), xérophtalmie, infections, peau sèche.',
    food_sources_fr: ['foie', 'jaune d’œuf', 'produits laitiers', 'légumes orange (carotte, patate douce)', 'épinards'],
  },
  {
    key: 'vit_d_mcg',
    name_fr: 'Vitamine D',
    category: 'vitamin_fat_soluble',
    unit: 'mcg',
    essential: true,
    rda_male: 15,
    rda_female: 15,
    upper_limit: 100,
    role_fr: 'Absorption calcium/phosphore, minéralisation osseuse, immunité, fonction musculaire.',
    deficiency_fr: 'Rachitisme (enfant), ostéomalacie, faiblesse musculaire, fractures.',
    food_sources_fr: ['poissons gras', 'jaune d’œuf', 'produits enrichis', 'exposition solaire (synthèse cutanée)'],
    notes_fr: 'Carence fréquente l’hiver / faible exposition solaire (≈ 600 UI = 15 mcg).',
  },
  {
    key: 'vit_e_mg',
    name_fr: 'Vitamine E (alpha-tocophérol)',
    category: 'vitamin_fat_soluble',
    unit: 'mg',
    essential: true,
    rda_male: 15,
    rda_female: 15,
    upper_limit: 1000,
    role_fr: 'Antioxydant majeur des membranes. Stockée en quantité importante.',
    deficiency_fr: 'Rare : neuropathie, anémie hémolytique, troubles neuromusculaires.',
    food_sources_fr: ['huiles végétales', 'oléagineux', 'graines', 'germes de blé', 'légumes verts'],
  },
  {
    key: 'vit_k_mcg',
    name_fr: 'Vitamine K',
    category: 'vitamin_fat_soluble',
    unit: 'mcg',
    essential: true,
    rda_male: 120,
    rda_female: 90,
    upper_limit: null,
    role_fr: 'Coagulation sanguine, métabolisme osseux.',
    deficiency_fr: 'Saignements, hématomes, troubles de la coagulation.',
    food_sources_fr: ['légumes verts à feuilles', 'choux', 'huiles végétales', 'natto'],
  },

  // ────────────────────── VITAMINES HYDROSOLUBLES ──────────────────────
  {
    key: 'vit_c_mg',
    name_fr: 'Vitamine C (acide ascorbique)',
    category: 'vitamin_water_soluble',
    unit: 'mg',
    essential: true,
    rda_male: 90,
    rda_female: 75,
    upper_limit: 2000,
    role_fr: 'Antioxydant, synthèse du collagène, absorption du fer non héminique, immunité. Non stockée.',
    deficiency_fr: 'Scorbut : fatigue, gencives qui saignent, mauvaise cicatrisation, ecchymoses.',
    food_sources_fr: ['agrumes', 'kiwi', 'poivron', 'fraise', 'brocoli', 'persil'],
    notes_fr: 'Non stockée → apport régulier nécessaire (+25 mg/j chez le fumeur).',
  },
  {
    key: 'vit_b1_mg',
    name_fr: 'Vitamine B1 (thiamine)',
    category: 'vitamin_water_soluble',
    unit: 'mg',
    essential: true,
    rda_male: 1.2,
    rda_female: 1.1,
    upper_limit: null,
    role_fr: 'Métabolisme énergétique des glucides, fonction nerveuse.',
    deficiency_fr: 'Béribéri, encéphalopathie de Wernicke (alcoolisme), neuropathie.',
    food_sources_fr: ['céréales complètes', 'porc', 'légumineuses', 'graines'],
    notes_fr: 'Éliminée lors du raffinage des céréales.',
  },
  {
    key: 'vit_b2_mg',
    name_fr: 'Vitamine B2 (riboflavine)',
    category: 'vitamin_water_soluble',
    unit: 'mg',
    essential: true,
    rda_male: 1.3,
    rda_female: 1.1,
    upper_limit: null,
    role_fr: 'Métabolisme énergétique, oxydoréduction cellulaire.',
    deficiency_fr: 'Chéilite, stomatite, dermatite séborrhéique.',
    food_sources_fr: ['produits laitiers', 'œufs', 'foie', 'légumes verts', 'céréales enrichies'],
  },
  {
    key: 'vit_b3_mg',
    name_fr: 'Vitamine B3 (niacine)',
    category: 'vitamin_water_soluble',
    unit: 'mg',
    essential: true,
    rda_male: 16,
    rda_female: 14,
    upper_limit: 35,
    role_fr: 'Métabolisme énergétique (NAD/NADP), réparation ADN.',
    deficiency_fr: 'Pellagre : dermatite, diarrhée, démence.',
    food_sources_fr: ['viande', 'volaille', 'poisson', 'arachides', 'céréales complètes'],
  },
  {
    key: 'vit_b5_mg',
    name_fr: 'Vitamine B5 (acide pantothénique)',
    category: 'vitamin_water_soluble',
    unit: 'mg',
    essential: true,
    rda_male: 5,
    rda_female: 5,
    upper_limit: null,
    role_fr: 'Synthèse du coenzyme A, métabolisme des lipides et glucides.',
    deficiency_fr: 'Rare : fatigue, paresthésies, irritabilité.',
    food_sources_fr: ['abats', 'œufs', 'avocat', 'champignons', 'céréales complètes'],
  },
  {
    key: 'vit_b6_mg',
    name_fr: 'Vitamine B6 (pyridoxine)',
    category: 'vitamin_water_soluble',
    unit: 'mg',
    essential: true,
    rda_male: 1.3,
    rda_female: 1.3,
    upper_limit: 100,
    role_fr: 'Métabolisme des acides aminés, neurotransmetteurs, hémoglobine.',
    deficiency_fr: 'Anémie, dermatite, neuropathie, confusion.',
    food_sources_fr: ['volaille', 'poisson', 'banane', 'pomme de terre', 'pois chiches'],
  },
  {
    key: 'vit_b8_mcg',
    name_fr: 'Vitamine B8 (biotine)',
    category: 'vitamin_water_soluble',
    unit: 'mcg',
    essential: true,
    rda_male: 30,
    rda_female: 30,
    upper_limit: null,
    role_fr: 'Cofacteur du métabolisme des glucides, lipides, protéines.',
    deficiency_fr: 'Rare : alopécie, dermatite, troubles neuro.',
    food_sources_fr: ['jaune d’œuf', 'foie', 'oléagineux', 'soja'],
  },
  {
    key: 'vit_b9_mcg',
    name_fr: 'Vitamine B9 (folate)',
    category: 'vitamin_water_soluble',
    unit: 'mcg',
    essential: true,
    rda_male: 400,
    rda_female: 400,
    upper_limit: 1000,
    role_fr: 'Synthèse ADN, division cellulaire, formation des globules rouges.',
    deficiency_fr: 'Anémie macrocytaire ; anomalies du tube neural chez le fœtus.',
    food_sources_fr: ['légumes verts à feuilles', 'légumineuses', 'foie', 'agrumes', 'céréales enrichies'],
    notes_fr: 'Besoin majoré à 600 mcg pendant la grossesse.',
  },
  {
    key: 'vit_b12_mcg',
    name_fr: 'Vitamine B12 (cobalamine)',
    category: 'vitamin_water_soluble',
    unit: 'mcg',
    essential: true,
    rda_male: 2.4,
    rda_female: 2.4,
    upper_limit: null,
    role_fr: 'Synthèse ADN, formation des globules rouges, fonction nerveuse. Seule vitamine B stockée en quantité.',
    deficiency_fr: 'Anémie macrocytaire, neuropathie, troubles cognitifs.',
    food_sources_fr: ['produits animaux (viande, poisson, œufs, laitages)'],
    notes_fr: 'Quasi absente du végétal → supplémentation nécessaire chez les végétaliens.',
  },

  // ─────────────────────────── MINÉRAUX MAJEURS ───────────────────────────
  {
    key: 'calcium_mg',
    name_fr: 'Calcium',
    category: 'mineral_major',
    unit: 'mg',
    essential: true,
    rda_male: 1000,
    rda_female: 1000,
    upper_limit: 2500,
    role_fr: 'Formation os/dents, coagulation, transmission neuromusculaire.',
    deficiency_fr: 'Déminéralisation osseuse, ostéoporose, tétanie.',
    food_sources_fr: ['produits laitiers', 'sardines', 'légumes verts', 'eaux calciques', 'tofu'],
  },
  {
    key: 'phosphorus_mg',
    name_fr: 'Phosphore',
    category: 'mineral_major',
    unit: 'mg',
    essential: true,
    rda_male: 700,
    rda_female: 700,
    upper_limit: 4000,
    role_fr: 'Formation os/dents, équilibre acide-base, production d’énergie (ATP).',
    deficiency_fr: 'Rare : faiblesse musculaire, douleurs osseuses.',
    food_sources_fr: ['produits laitiers', 'viandes', 'poissons', 'céréales', 'noix', 'légumineuses'],
  },
  {
    key: 'magnesium_mg',
    name_fr: 'Magnésium',
    category: 'mineral_major',
    unit: 'mg',
    essential: true,
    rda_male: 420,
    rda_female: 320,
    upper_limit: null,
    role_fr: 'Cofacteur de 300+ enzymes, transmission nerveuse, contraction musculaire, os.',
    deficiency_fr: 'Crampes, fatigue, irritabilité, arythmie ; cravings (salé/sucré).',
    food_sources_fr: ['légumes verts à feuilles', 'oléagineux', 'graines', 'céréales complètes', 'fruits de mer'],
  },
  {
    key: 'sodium_mg',
    name_fr: 'Sodium',
    category: 'mineral_major',
    unit: 'mg',
    essential: true,
    rda_male: 1500,
    rda_female: 1500,
    upper_limit: 2300,
    role_fr: 'Équilibre hydrique, pression osmotique, contraction musculaire, influx nerveux.',
    deficiency_fr: 'Hyponatrémie : confusion, crampes (rare, surtout sudation extrême).',
    food_sources_fr: ['sel', 'aliments transformés', 'charcuterie', 'fromage', 'pain'],
    notes_fr: 'Le problème courant est l’EXCÈS (UL ~2300 mg) plus que la carence.',
  },
  {
    key: 'potassium_mg',
    name_fr: 'Potassium',
    category: 'mineral_major',
    unit: 'mg',
    essential: true,
    rda_male: 3500,
    rda_female: 3500,
    upper_limit: null,
    role_fr: 'Contraction musculaire, influx nerveux, équilibre hydrique, tension artérielle.',
    deficiency_fr: 'Hypokaliémie : faiblesse, crampes, arythmie.',
    food_sources_fr: ['banane', 'pomme de terre', 'légumineuses', 'épinards', 'pruneaux', 'viandes'],
  },
  {
    key: 'chloride_mg',
    name_fr: 'Chlorure',
    category: 'mineral_major',
    unit: 'mg',
    essential: true,
    rda_male: 2300,
    rda_female: 2300,
    upper_limit: 3600,
    role_fr: 'Équilibre acide-base, pression osmotique, suc gastrique.',
    deficiency_fr: 'Rare : alcalose, surtout vomissements prolongés.',
    food_sources_fr: ['sel de table', 'aliments transformés'],
  },

  // ─────────────────────────── OLIGO-ÉLÉMENTS ───────────────────────────
  {
    key: 'iron_mg',
    name_fr: 'Fer',
    category: 'trace_element',
    unit: 'mg',
    essential: true,
    rda_male: 8,
    rda_female: 18,
    upper_limit: 45,
    role_fr: 'Transport de l’oxygène (hémoglobine), enzymes, énergie.',
    deficiency_fr: 'Anémie ferriprive : fatigue, pâleur, essoufflement. Carence fréquente.',
    food_sources_fr: ['viande rouge', 'abats', 'légumineuses', 'épinards', 'tofu', 'céréales enrichies'],
    notes_fr: 'Besoin majoré chez la femme menstruée (18 mg) ; vitamine C améliore l’absorption du fer végétal.',
  },
  {
    key: 'zinc_mg',
    name_fr: 'Zinc',
    category: 'trace_element',
    unit: 'mg',
    essential: true,
    rda_male: 11,
    rda_female: 8,
    upper_limit: 40,
    role_fr: 'Enzymes, immunité, cicatrisation, synthèse protéique, fonction hormonale (testostérone).',
    deficiency_fr: 'Retard de croissance, immunité affaiblie, mauvaise cicatrisation, perte de goût. Carence fréquente.',
    food_sources_fr: ['huîtres', 'viande', 'graines de courge', 'légumineuses', 'noix'],
  },
  {
    key: 'copper_mg',
    name_fr: 'Cuivre',
    category: 'trace_element',
    unit: 'mg',
    essential: true,
    rda_male: 0.9,
    rda_female: 0.9,
    upper_limit: 10,
    role_fr: 'Enzymes (métabolisme du fer, antioxydant), tissu conjonctif.',
    deficiency_fr: 'Rare : anémie, neutropénie, troubles osseux.',
    food_sources_fr: ['abats', 'fruits de mer', 'oléagineux', 'graines', 'chocolat noir'],
  },
  {
    key: 'iodine_mcg',
    name_fr: 'Iode',
    category: 'trace_element',
    unit: 'mcg',
    essential: true,
    rda_male: 150,
    rda_female: 150,
    upper_limit: 1100,
    role_fr: 'Synthèse des hormones thyroïdiennes (métabolisme).',
    deficiency_fr: 'Goitre, hypothyroïdie ; chez le fœtus, retard de développement.',
    food_sources_fr: ['sel iodé', 'poissons de mer', 'fruits de mer', 'produits laitiers', 'algues'],
  },
  {
    key: 'selenium_mcg',
    name_fr: 'Sélénium',
    category: 'trace_element',
    unit: 'mcg',
    essential: true,
    rda_male: 55,
    rda_female: 55,
    upper_limit: 400,
    role_fr: 'Antioxydant (glutathion peroxydase), métabolisme thyroïdien, immunité.',
    deficiency_fr: 'Rare : cardiomyopathie (Keshan), troubles immunitaires.',
    food_sources_fr: ['noix du Brésil', 'poissons', 'œufs', 'viande', 'céréales complètes'],
  },
  {
    key: 'manganese_mg',
    name_fr: 'Manganèse',
    category: 'trace_element',
    unit: 'mg',
    essential: true,
    rda_male: 2.3,
    rda_female: 1.8,
    upper_limit: 11,
    role_fr: 'Enzymes (métabolisme, antioxydant), formation osseuse.',
    deficiency_fr: 'Très rare.',
    food_sources_fr: ['céréales complètes', 'oléagineux', 'thé', 'légumineuses'],
  },
  {
    key: 'chromium_mcg',
    name_fr: 'Chrome',
    category: 'trace_element',
    unit: 'mcg',
    essential: true,
    rda_male: 35,
    rda_female: 25,
    upper_limit: null,
    role_fr: 'Potentialise l’action de l’insuline (métabolisme du glucose). Non incorporé dans des enzymes.',
    deficiency_fr: 'Rare : intolérance au glucose.',
    food_sources_fr: ['céréales complètes', 'brocoli', 'viande', 'levure de bière'],
  },
  {
    key: 'molybdenum_mcg',
    name_fr: 'Molybdène',
    category: 'trace_element',
    unit: 'mcg',
    essential: true,
    rda_male: 45,
    rda_female: 45,
    upper_limit: 2000,
    role_fr: 'Cofacteur enzymatique (métabolisme des acides aminés soufrés, purines).',
    deficiency_fr: 'Extrêmement rare.',
    food_sources_fr: ['légumineuses', 'céréales complètes', 'abats', 'oléagineux'],
  },
  {
    key: 'fluoride_mg',
    name_fr: 'Fluor (fluorure)',
    category: 'trace_element',
    unit: 'mg',
    essential: false,
    rda_male: 4,
    rda_female: 3,
    upper_limit: 10,
    role_fr: 'Non essentiel ; renforce l’émail dentaire (CaF₂) et prévient les caries.',
    deficiency_fr: 'Caries dentaires accrues.',
    food_sources_fr: ['eau fluorée', 'thé', 'poissons', 'dentifrice fluoré'],
    notes_fr: 'Excès → fluorose dentaire/osseuse.',
  },
];

/** Index par clé pour lookup O(1). */
export const NUTRIENT_BY_KEY: Record<string, NutrientReference> = Object.fromEntries(
  NUTRIENT_REFERENCE.map((n) => [n.key, n]),
);

export function getNutrient(key: string): NutrientReference | undefined {
  return NUTRIENT_BY_KEY[key];
}

export function nutrientsByCategory(category: NutrientCategory): NutrientReference[] {
  return NUTRIENT_REFERENCE.filter((n) => n.category === category);
}

/** AJR selon le sexe (retombe sur l'autre valeur si une seule est définie). */
export function rdaForSex(n: NutrientReference, sex: 'male' | 'female' | null): number | null {
  if (sex === 'female') return n.rda_female ?? n.rda_male;
  if (sex === 'male') return n.rda_male ?? n.rda_female;
  return n.rda_male ?? n.rda_female;
}

/** Disclaimer à rappeler côté coach quand il s'appuie sur ces repères. */
export const NUTRIENT_DB_DISCLAIMER =
  "Repères de population adulte (ANC/ANSES, EFSA, RDA US) — pas un avis médical ni une prescription. Les besoins varient (âge, grossesse, pathologie, sport). Toute suspicion de carence → médecin.";
