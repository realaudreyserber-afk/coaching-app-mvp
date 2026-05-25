import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Clock, Flame } from "lucide-react";
import { RECIPES } from "@/content/recipes/library";
import { StatPill } from "@/components/ui/stat-pill";

export async function generateStaticParams() {
  return RECIPES.map((r) => ({ recipeId: r.id }));
}

interface RecipeDetailPageProps {
  params: Promise<{ recipeId: string }>;
}

const GOAL_LABELS: Record<string, string> = {
  "prise-masse": "Prise de masse",
  seche: "Sèche",
  maintien: "Maintien",
};

const MEAL_LABELS: Record<string, string> = {
  "petit-dejeuner": "Petit-déjeuner",
  dejeuner: "Déjeuner",
  diner: "Dîner",
  collation: "Collation",
};

export default async function RecipeDetailPage({ params }: RecipeDetailPageProps) {
  const { recipeId } = await params;
  const recipe = RECIPES.find((r) => r.id === recipeId);
  if (!recipe) notFound();

  return (
    <div className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10 space-y-8">
      {/* Back */}
      <Link
        href="/recipes"
        className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-amber-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Retour à la bibliothèque
      </Link>

      {/* Header */}
      <header className="space-y-3">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-semibold text-amber-500">
          <span>{MEAL_LABELS[recipe.mealType]}</span>
        </div>
        <h1 className="text-3xl lg:text-4xl font-bold font-serif text-zinc-50 leading-tight">
          {recipe.name}
        </h1>
        <p className="text-base text-zinc-400 leading-relaxed">
          {recipe.description}
        </p>
      </header>

      {/* Stats row */}
      <div className="flex flex-wrap gap-4 items-center text-sm">
        <span className="inline-flex items-center gap-1.5 text-zinc-200">
          <Flame className="h-4 w-4 text-amber-500" aria-hidden="true" />
          <span className="font-bold text-amber-400 tabular-nums">{recipe.kcal}</span>
          <span className="text-zinc-400">kcal</span>
        </span>
        <span className="inline-flex items-center gap-1.5 text-zinc-200">
          <Clock className="h-4 w-4 text-zinc-400" aria-hidden="true" />
          <span className="font-bold tabular-nums">{recipe.prepMinutes}</span>
          <span className="text-zinc-400">min de préparation</span>
        </span>
      </div>

      {/* Macros */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 space-y-3">
        <h2 className="text-sm font-serif font-bold text-zinc-50 uppercase tracking-wider">
          Macros par portion
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <MacroCell label="Protéines" value={recipe.macros.p} />
          <MacroCell label="Glucides" value={recipe.macros.c} />
          <MacroCell label="Lipides" value={recipe.macros.f} />
        </div>
      </div>

      {/* Tags */}
      <div className="space-y-2">
        <h2 className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">
          Objectifs compatibles
        </h2>
        <div className="flex flex-wrap gap-2">
          {recipe.goal.map((g) => (
            <StatPill key={g} value={GOAL_LABELS[g]} variant="gold" />
          ))}
        </div>
      </div>

      <p className="text-center text-xs text-zinc-500 pt-4 border-t border-zinc-800">
        Phase 1 — la recette détaillée avec étapes de préparation et bouton
        « Ajouter au plan » arrive en Phase 2.
      </p>
    </div>
  );
}

function MacroCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-zinc-950 p-3 rounded-md text-center">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
        {label}
      </p>
      <p className="text-xl font-bold font-serif text-zinc-50 tabular-nums mt-1">
        {value}
        <span className="text-xs text-zinc-400 ml-0.5">g</span>
      </p>
    </div>
  );
}
