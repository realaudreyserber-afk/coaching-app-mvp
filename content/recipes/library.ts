/**
 * Bibliothèque de recettes (mock data Phase 1).
 *
 * Phase 2 : déplacer vers Firestore collection `recipes/{recipeId}` avec
 * photos générées via Nano Banana 2 ou banque d'images food premium.
 *
 * Les valeurs nutritionnelles sont des moyennes approximatives — pas un
 * référentiel scientifique. Pour le tracking précis, l'utilisateur utilise
 * la calc de macros dans /plan.
 */

export type RecipeGoal = "prise-masse" | "seche" | "maintien";
export type RecipeMealType =
  | "petit-dejeuner"
  | "dejeuner"
  | "diner"
  | "collation";
export type RecipePrep = "rapide" | "moyen" | "long";

export interface Recipe {
  id: string;
  name: string;
  description: string;
  /** kcal par portion */
  kcal: number;
  macros: { p: number; c: number; f: number };
  /** Temps prep en minutes */
  prepMinutes: number;
  prepBucket: RecipePrep;
  mealType: RecipeMealType;
  goal: RecipeGoal[];
  /** Photo (placeholder si absent) */
  photoUrl?: string;
}

export const RECIPES: Recipe[] = [
  {
    id: "saumon-asperges",
    photoUrl: "/meals/saumon-asperges.jpg",
    name: "Saumon poêlé aux asperges",
    description:
      "Filet de saumon sauvage, asperges vertes, citron, huile d'olive vierge.",
    kcal: 550,
    macros: { p: 45, c: 10, f: 30 },
    prepMinutes: 20,
    prepBucket: "moyen",
    mealType: "dejeuner",
    goal: ["seche", "maintien"],
  },
  {
    id: "pancakes-proteines",
    photoUrl: "/meals/pancakes-proteines.jpg",
    name: "Pancakes protéinés",
    description:
      "Flocons d'avoine, blanc d'œuf, whey vanille, banane écrasée, cannelle.",
    kcal: 400,
    macros: { p: 35, c: 50, f: 5 },
    prepMinutes: 15,
    prepBucket: "rapide",
    mealType: "petit-dejeuner",
    goal: ["prise-masse", "maintien"],
  },
  {
    id: "boeuf-brocolis",
    photoUrl: "/meals/boeuf-brocolis.jpg",
    name: "Bœuf sauté brocolis",
    description:
      "Aiguillettes de bœuf 5 %, brocolis vapeur, sauce soja salée réduite, riz basmati.",
    kcal: 580,
    macros: { p: 50, c: 55, f: 12 },
    prepMinutes: 25,
    prepBucket: "moyen",
    mealType: "diner",
    goal: ["prise-masse", "maintien"],
  },
  {
    id: "salade-quinoa",
    photoUrl: "/meals/salade-quinoa.jpg",
    name: "Salade quinoa végétal",
    description:
      "Quinoa tricolore, pois chiches grillés, avocat, tomates cerises, vinaigrette.",
    kcal: 480,
    macros: { p: 22, c: 50, f: 18 },
    prepMinutes: 18,
    prepBucket: "rapide",
    mealType: "dejeuner",
    goal: ["seche", "maintien"],
  },
  {
    id: "poulet-herbes",
    photoUrl: "/meals/poulet-herbes.jpg",
    name: "Poulet grillé aux herbes",
    description:
      "Blanc de poulet, thym/romarin, patate douce, haricots verts vapeur.",
    kcal: 480,
    macros: { p: 50, c: 35, f: 8 },
    prepMinutes: 22,
    prepBucket: "moyen",
    mealType: "diner",
    goal: ["seche", "maintien"],
  },
  {
    id: "smoothie-proteine",
    photoUrl: "/meals/smoothie-proteine.jpg",
    name: "Smoothie protéiné vert",
    description:
      "Épinards, whey vanille, banane, lait d'amande, graines de chia.",
    kcal: 350,
    macros: { p: 30, c: 35, f: 8 },
    prepMinutes: 5,
    prepBucket: "rapide",
    mealType: "collation",
    goal: ["prise-masse", "maintien"],
  },
  {
    id: "oeufs-truffe",
    photoUrl: "/meals/oeufs-truffe.jpg",
    name: "Œufs brouillés à la truffe",
    description:
      "Œufs brouillés crémeux, huile de truffe, pain complet, baby spinach.",
    kcal: 480,
    macros: { p: 28, c: 25, f: 25 },
    prepMinutes: 10,
    prepBucket: "rapide",
    mealType: "petit-dejeuner",
    goal: ["maintien"],
  },
  {
    id: "barre-proteinee",
    photoUrl: "/meals/barre-proteinee.jpg",
    name: "Barre protéinée maison",
    description:
      "Avoine, dattes, noix, chocolat noir 85 %, whey, beurre d'amande.",
    kcal: 280,
    macros: { p: 18, c: 25, f: 12 },
    prepMinutes: 30,
    prepBucket: "moyen",
    mealType: "collation",
    goal: ["prise-masse", "maintien"],
  },
  {
    id: "filet-mignon-patate-douce",
    photoUrl: "/meals/filet-mignon-patate-douce.jpg",
    name: "Filet mignon, patate douce",
    description:
      "Filet mignon de bœuf, purée de patate douce maison, légumes verts rôtis.",
    kcal: 650,
    macros: { p: 50, c: 55, f: 22 },
    prepMinutes: 35,
    prepBucket: "long",
    mealType: "diner",
    goal: ["prise-masse"],
  },
  {
    id: "bowl-avoine-baies",
    photoUrl: "/meals/bowl-avoine-baies.jpg",
    name: "Bol avoine doré aux baies",
    description:
      "Flocons d'avoine, lait d'amande, myrtilles, noix, miel, cannelle.",
    kcal: 450,
    macros: { p: 15, c: 65, f: 12 },
    prepMinutes: 8,
    prepBucket: "rapide",
    mealType: "petit-dejeuner",
    goal: ["prise-masse", "maintien"],
  },
  {
    id: "cabillaud-courgettes",
    photoUrl: "/meals/cabillaud-courgettes.jpg",
    name: "Cabillaud aux courgettes",
    description:
      "Dos de cabillaud, courgettes grillées au citron, riz complet.",
    kcal: 420,
    macros: { p: 38, c: 45, f: 6 },
    prepMinutes: 25,
    prepBucket: "moyen",
    mealType: "diner",
    goal: ["seche"],
  },
  {
    id: "yaourt-fruits-noix",
    photoUrl: "/meals/yaourt-fruits-noix.jpg",
    name: "Yaourt grec, fruits, noix",
    description:
      "Yaourt grec 0 %, fruits rouges, noix de pécan, miel d'acacia.",
    kcal: 300,
    macros: { p: 22, c: 25, f: 10 },
    prepMinutes: 3,
    prepBucket: "rapide",
    mealType: "collation",
    goal: ["seche", "maintien"],
  },
  {
    id: "frittata-epinards",
    photoUrl: "/meals/frittata-epinards.jpg",
    name: "Frittata de blancs d'œufs aux épinards",
    description: "Blancs d'œufs, épinards frais, oignons, poivrons rouges, blanc de dinde émietté.",
    kcal: 320,
    macros: { p: 40, c: 10, f: 12 },
    prepMinutes: 15,
    prepBucket: "rapide",
    mealType: "petit-dejeuner",
    goal: ["seche", "maintien"],
  },
  {
    id: "burrito-complet",
    photoUrl: "/meals/burrito-complet.jpg",
    name: "Burrito petit-déjeuner complet",
    description: "Œufs brouillés, haricots noirs, saucisse de poulet grillée, avocat, wrap de blé complet.",
    kcal: 520,
    macros: { p: 38, c: 45, f: 18 },
    prepMinutes: 15,
    prepBucket: "rapide",
    mealType: "petit-dejeuner",
    goal: ["prise-masse", "maintien"],
  },
  {
    id: "poulet-cajun",
    photoUrl: "/meals/poulet-cajun.jpg",
    name: "Bowl de poulet Cajun et patates douces",
    description: "Blanc de poulet épicé Cajun, patates douces rôties, haricots verts, avocat.",
    kcal: 560,
    macros: { p: 48, c: 50, f: 15 },
    prepMinutes: 25,
    prepBucket: "moyen",
    mealType: "dejeuner",
    goal: ["prise-masse", "maintien"],
  },
  {
    id: "salade-tacos-dinde",
    photoUrl: "/meals/salade-tacos-dinde.jpg",
    name: "Salade de tacos de dinde jar",
    description: "Dinde hachée maigre épicée, laitue romaine, tomates cerises, haricots noirs, maïs, avocat.",
    kcal: 490,
    macros: { p: 42, c: 35, f: 16 },
    prepMinutes: 20,
    prepBucket: "moyen",
    mealType: "dejeuner",
    goal: ["seche", "maintien"],
  },
  {
    id: "overnight-oats",
    photoUrl: "/meals/overnight-oats.jpg",
    name: "Overnight Oats protéinés aux baies",
    description: "Flocons d'avoine, lait d'amande, whey protéine, graines de chia, myrtilles et framboises fraîches.",
    kcal: 380,
    macros: { p: 30, c: 48, f: 6 },
    prepMinutes: 10,
    prepBucket: "rapide",
    mealType: "collation",
    goal: ["prise-masse", "maintien"],
  },
  {
    id: "wok-boeuf-gingembre",
    photoUrl: "/meals/wok-boeuf-gingembre.jpg",
    name: "Wok de bœuf gingembre et brocolis",
    description: "Rumsteck de bœuf émincé, têtes de brocoli, poivrons, sauce soja réduite en sodium, nouilles de riz.",
    kcal: 610,
    macros: { p: 52, c: 60, f: 14 },
    prepMinutes: 25,
    prepBucket: "moyen",
    mealType: "diner",
    goal: ["prise-masse", "maintien"],
  },
  {
    id: "cabillaud-croute-herbes",
    photoUrl: "/meals/cabillaud-croute-herbes.jpg",
    name: "Cabillaud en croûte d'herbes",
    description: "Filet de cabillaud, chapelure de blé complet aux herbes fraîches, asperges, quinoa.",
    kcal: 410,
    macros: { p: 35, c: 40, f: 8 },
    prepMinutes: 20,
    prepBucket: "moyen",
    mealType: "diner",
    goal: ["seche", "maintien"],
  },
  {
    id: "bowl-fromage-blanc",
    photoUrl: "/meals/bowl-fromage-blanc.jpg",
    name: "Bowl de fromage blanc protéiné",
    description: "Fromage blanc 0 %, protéines de lactosérum (whey) vanille, beurre de cacahuète, granola maison.",
    kcal: 340,
    macros: { p: 32, c: 28, f: 10 },
    prepMinutes: 5,
    prepBucket: "rapide",
    mealType: "collation",
    goal: ["seche", "maintien"],
  },
];
