/**
 * Group plan supplements by the meal they belong to, via fuzzy match of
 * `supplement.timing` vs `meal.name`.
 *
 * Used by /plan UI to display each supplement inside its meal card rather
 * than a separate "Supplements" section.
 *
 * Matching logic:
 *   1. Normalize both strings (lowercase, strip accents, trim)
 *   2. Exact equality wins
 *   3. Otherwise: substring match in either direction
 *   4. Otherwise: the supplement is "orphan" → goes to the "Hors repas" bucket
 */

export interface PlanSupplement {
  name: string;
  dosage: string;
  timing: string;
}

export interface PlanMeal {
  name: string;
  description: string;
  approx_kcal: number;
}

export interface MealWithSupplements extends PlanMeal {
  supplements: PlanSupplement[];
}

export interface GroupedSupplementsResult {
  meals: MealWithSupplements[];
  orphans: PlanSupplement[];
}

function normalize(s: string | undefined | null): string {
  if (!s) return '';
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tryMatchMeal(timing: string, meals: PlanMeal[]): number {
  const t = normalize(timing);
  if (!t) return -1;

  // Pass 1: exact equality
  for (let i = 0; i < meals.length; i++) {
    if (normalize(meals[i].name) === t) return i;
  }

  // Pass 2: meal name fully contained in timing (e.g. "avec le petit-déjeuner")
  for (let i = 0; i < meals.length; i++) {
    const n = normalize(meals[i].name);
    if (n && t.includes(n)) return i;
  }

  // Pass 3: timing fully contained in meal name (rare, defensive)
  for (let i = 0; i < meals.length; i++) {
    const n = normalize(meals[i].name);
    if (n && n.includes(t) && t.length > 3) return i;
  }

  return -1;
}

export function groupSupplementsByMeal(
  meals: PlanMeal[] | undefined,
  supplements: PlanSupplement[] | undefined
): GroupedSupplementsResult {
  const safeMeals = meals ?? [];
  const safeSupps = supplements ?? [];

  const out: MealWithSupplements[] = safeMeals.map((m) => ({ ...m, supplements: [] }));
  const orphans: PlanSupplement[] = [];

  for (const sup of safeSupps) {
    const idx = tryMatchMeal(sup.timing, safeMeals);
    if (idx >= 0) {
      out[idx].supplements.push(sup);
    } else {
      orphans.push(sup);
    }
  }

  return { meals: out, orphans };
}
