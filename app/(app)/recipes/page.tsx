"use client";

import { useState, useMemo } from "react";
import { RECIPES } from "@/content/recipes/library";
import { RecipeCard } from "@/components/recipes/recipe-card";
import { FilterSidebar, RecipeFilters } from "@/components/recipes/filter-sidebar";

/**
 * /recipes — Bibliothèque "Cuisine Performance".
 *
 * Stitch ref : recipe-d.jpg (sidebar gauche filtres + grid 2x3 plats avec photos).
 *
 * Phase 1 : mock data depuis content/recipes/library.ts (12 recettes seed).
 * Phase 2 : Firestore collection `recipes/{id}` avec photos générées Nano Banana 2.
 */

export default function RecipesPage() {
  const [filters, setFilters] = useState<RecipeFilters>({
    goal: null,
    meal: null,
    prep: null,
  });

  const filtered = useMemo(() => {
    return RECIPES.filter((r) => {
      if (filters.goal && !r.goal.includes(filters.goal)) return false;
      if (filters.meal && r.mealType !== filters.meal) return false;
      if (filters.prep && r.prepBucket !== filters.prep) return false;
      return true;
    });
  }, [filters]);

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10 space-y-8">
      {/* Header */}
      <header>
        <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-amber-500 mb-3">
          <div className="h-px w-8 bg-amber-500" aria-hidden="true" />
          <span className="font-semibold">Bibliothèque</span>
        </div>
        <h1 className="text-3xl lg:text-5xl font-bold font-serif text-zinc-50">
          Cuisine <span className="text-amber-400">performance</span>
        </h1>
        <p className="mt-3 text-base text-zinc-400 max-w-2xl">
          Recettes calibrées sur tes objectifs. Macros affichés, temps de prep
          réaliste, ingrédients simples.
        </p>
      </header>

      {/* Layout : sidebar + grid */}
      <div className="grid gap-6 lg:gap-8 lg:grid-cols-[16rem_1fr]">
        <div className="lg:sticky lg:top-6 lg:self-start">
          <FilterSidebar
            filters={filters}
            onChange={setFilters}
            resultCount={filtered.length}
          />
        </div>

        <section
          aria-label={`${filtered.length} recettes`}
          className="space-y-4"
        >
          {filtered.length === 0 ? (
            <div className="text-center py-16 px-4 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400">
              <p className="text-base font-serif font-semibold text-zinc-200">
                Aucune recette ne correspond.
              </p>
              <p className="mt-2 text-xs">
                Essaie de retirer un ou deux filtres.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((r) => (
                <RecipeCard key={r.id} recipe={r} />
              ))}
            </div>
          )}
        </section>
      </div>

      <p className="text-center text-xs text-zinc-500 max-w-2xl mx-auto pt-4 border-t border-zinc-800">
        Phase 1 : 12 recettes seed. Phase 2 = collection enrichie + photos
        éditoriales food premium + bouton « Ajouter au plan ».
      </p>
    </div>
  );
}
