import { RECIPES, Recipe } from "@/content/recipes/library";

/**
 * Finds a matching recipe in the Cuisine Performance library based on the meal name and description keywords.
 */
export function getRecipeForMealName(mealName: string, mealDescription = ""): Recipe | undefined {
  const nameLower = (mealName || "").toLowerCase();
  const descLower = (mealDescription || "").toLowerCase();
  const combined = `${nameLower} ${descLower}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // Remove accents

  if (combined.includes("saumon")) {
    return RECIPES.find(r => r.id === "saumon-asperges");
  }
  if (combined.includes("pancake")) {
    return RECIPES.find(r => r.id === "pancakes-proteines");
  }
  if (combined.includes("cajun")) {
    return RECIPES.find(r => r.id === "poulet-cajun");
  }
  if (combined.includes("poulet")) {
    return RECIPES.find(r => r.id === "poulet-herbes");
  }
  if (combined.includes("wok") || combined.includes("gingembre")) {
    return RECIPES.find(r => r.id === "wok-boeuf-gingembre");
  }
  if (combined.includes("boeuf")) {
    return RECIPES.find(r => r.id === "boeuf-brocolis");
  }
  if (combined.includes("quinoa")) {
    return RECIPES.find(r => r.id === "salade-quinoa");
  }
  if (combined.includes("smoothie")) {
    return RECIPES.find(r => r.id === "smoothie-proteine");
  }
  if (combined.includes("frittata")) {
    return RECIPES.find(r => r.id === "frittata-epinards");
  }
  if (combined.includes("oeuf") || combined.includes("omelette")) {
    return RECIPES.find(r => r.id === "oeufs-truffe");
  }
  if (combined.includes("barre")) {
    return RECIPES.find(r => r.id === "barre-proteinee");
  }
  if (combined.includes("mignon")) {
    return RECIPES.find(r => r.id === "filet-mignon-patate-douce");
  }
  if (combined.includes("overnight")) {
    return RECIPES.find(r => r.id === "overnight-oats");
  }
  if (combined.includes("avoine") || combined.includes("porridge") || combined.includes("oat")) {
    return RECIPES.find(r => r.id === "bowl-avoine-baies");
  }
  if (combined.includes("croute d'herbes") || combined.includes("croûte d'herbes")) {
    return RECIPES.find(r => r.id === "cabillaud-croute-herbes");
  }
  if (combined.includes("cabillaud")) {
    return RECIPES.find(r => r.id === "cabillaud-courgettes");
  }
  if (combined.includes("burrito")) {
    return RECIPES.find(r => r.id === "burrito-complet");
  }
  if (combined.includes("tacos") || combined.includes("dinde")) {
    return RECIPES.find(r => r.id === "salade-tacos-dinde");
  }
  if (combined.includes("fromage blanc")) {
    return RECIPES.find(r => r.id === "bowl-fromage-blanc");
  }
  if (combined.includes("yaourt") || combined.includes("skyr")) {
    return RECIPES.find(r => r.id === "yaourt-fruits-noix");
  }

  // Fallback to direct name contains
  return RECIPES.find((recipe) => {
    const normalizedRecipeName = recipe.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    return (
      combined.includes(normalizedRecipeName) ||
      normalizedRecipeName.includes(combined)
    );
  });
}
