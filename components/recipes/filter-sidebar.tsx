"use client";

import * as React from "react";
import type {
  RecipeGoal,
  RecipeMealType,
  RecipePrep,
} from "@/content/recipes/library";

/**
 * Filter Sidebar — filtres pour la library de recettes.
 * Stitch ref : recipe-d.jpg (sidebar gauche avec Objectif / Temps / Type repas)
 */

const GOAL_LABELS: Record<RecipeGoal, string> = {
  "prise-masse": "Prise de masse",
  seche: "Sèche",
  maintien: "Maintien",
};

const MEAL_LABELS: Record<RecipeMealType, string> = {
  "petit-dejeuner": "Petit-déjeuner",
  dejeuner: "Déjeuner",
  diner: "Dîner",
  collation: "Collation",
};

const PREP_LABELS: Record<RecipePrep, string> = {
  rapide: "Rapide (< 20 min)",
  moyen: "Moyen (< 45 min)",
  long: "Long (> 45 min)",
};

export interface RecipeFilters {
  goal: RecipeGoal | null;
  meal: RecipeMealType | null;
  prep: RecipePrep | null;
}

interface FilterSidebarProps {
  filters: RecipeFilters;
  onChange: (next: RecipeFilters) => void;
  /** Nombre de recettes filtrées (affiché en bas) */
  resultCount: number;
}

export function FilterSidebar({
  filters,
  onChange,
  resultCount,
}: FilterSidebarProps) {
  return (
    <aside
      aria-label="Filtres recettes"
      className="space-y-6 rounded-lg border border-zinc-800 bg-zinc-900 p-5"
    >
      <h2 className="text-sm font-serif font-bold text-zinc-50 uppercase tracking-wider">
        Filtres
      </h2>

      <FilterGroup
        legend="Objectif"
        options={Object.entries(GOAL_LABELS) as [RecipeGoal, string][]}
        value={filters.goal}
        onChange={(v) => onChange({ ...filters, goal: v })}
      />

      <FilterGroup
        legend="Temps de préparation"
        options={Object.entries(PREP_LABELS) as [RecipePrep, string][]}
        value={filters.prep}
        onChange={(v) => onChange({ ...filters, prep: v })}
      />

      <FilterGroup
        legend="Type de repas"
        options={Object.entries(MEAL_LABELS) as [RecipeMealType, string][]}
        value={filters.meal}
        onChange={(v) => onChange({ ...filters, meal: v })}
      />

      <div className="pt-4 border-t border-zinc-800 space-y-2">
        <p className="text-xs text-zinc-400">
          <span className="font-semibold text-amber-400 tabular-nums">
            {resultCount}
          </span>{" "}
          {resultCount > 1 ? "recettes correspondent" : "recette correspond"}
        </p>
        {(filters.goal || filters.meal || filters.prep) && (
          <button
            type="button"
            onClick={() => onChange({ goal: null, meal: null, prep: null })}
            className="text-[10px] uppercase tracking-wider font-semibold text-zinc-500 hover:text-amber-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded"
          >
            Réinitialiser
          </button>
        )}
      </div>
    </aside>
  );
}

interface FilterGroupProps<T extends string> {
  legend: string;
  options: Array<[T, string]>;
  value: T | null;
  onChange: (value: T | null) => void;
}

function FilterGroup<T extends string>({
  legend,
  options,
  value,
  onChange,
}: FilterGroupProps<T>) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-2">
        {legend}
      </legend>
      <div className="space-y-1.5">
        {options.map(([key, label]) => {
          const checked = value === key;
          return (
            <label
              key={key}
              className="flex items-center gap-2 cursor-pointer text-sm text-zinc-200 hover:text-zinc-50 transition-colors group"
            >
              <input
                type="radio"
                name={legend}
                value={key}
                checked={checked}
                onChange={() => onChange(checked ? null : key)}
                onClick={() => {
                  // Allow toggle off on second click on same radio
                  if (checked) onChange(null);
                }}
                className="sr-only peer"
              />
              <span
                aria-hidden="true"
                className={`h-4 w-4 rounded-sm border-2 flex items-center justify-center transition-colors ${
                  checked
                    ? "bg-amber-500 border-amber-500"
                    : "border-zinc-600 group-hover:border-zinc-400"
                }`}
              >
                {checked && (
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 10 10"
                    fill="none"
                    className="text-zinc-950"
                  >
                    <path
                      d="M2 5L4 7L8 3"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>
              <span className="select-none">{label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
