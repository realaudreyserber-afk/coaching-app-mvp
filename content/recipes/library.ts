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
];
