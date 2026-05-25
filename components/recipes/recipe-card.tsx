"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Clock } from "lucide-react";
import { StatPill } from "@/components/ui/stat-pill";
import type { Recipe } from "@/content/recipes/library";

interface RecipeCardProps {
  recipe: Recipe;
  className?: string;
}

export function RecipeCard({ recipe, className = "" }: RecipeCardProps) {
  return (
    <Link
      href={`/recipes/${recipe.id}`}
      aria-label={`Voir la recette : ${recipe.name}`}
      className={`group block overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 transition-all hover:border-amber-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 ${className}`}
    >
      <div className="relative aspect-[4/3] bg-zinc-800 overflow-hidden">
        {recipe.photoUrl ? (
          <Image
            src={recipe.photoUrl}
            alt={recipe.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <RecipePlaceholder name={recipe.name} />
        )}
        {/* Time + kcal overlay */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/80 to-transparent"
        />
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-950/80 text-zinc-200 text-[10px] font-semibold border border-zinc-700">
            <Clock className="h-3 w-3" aria-hidden="true" />
            <span className="tabular-nums">{recipe.prepMinutes} min</span>
          </span>
          <span className="px-2 py-0.5 rounded-md bg-zinc-950/80 text-amber-400 text-[10px] font-bold tabular-nums border border-amber-500/30">
            {recipe.kcal} kcal
          </span>
        </div>
      </div>

      <div className="p-4 space-y-2">
        <h3 className="text-base font-serif font-bold text-zinc-50 leading-tight">
          {recipe.name}
        </h3>
        <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2">
          {recipe.description}
        </p>
        <div className="flex flex-wrap gap-1.5 pt-1">
          <StatPill label="P" value={recipe.macros.p} unit="g" />
          <StatPill label="G" value={recipe.macros.c} unit="g" />
          <StatPill label="L" value={recipe.macros.f} unit="g" />
        </div>
      </div>
    </Link>
  );
}

function RecipePlaceholder({ name }: { name: string }) {
  const initial = name.charAt(0).toUpperCase();
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950"
    >
      <span className="font-serif text-6xl font-bold text-amber-500/30 select-none">
        {initial}
      </span>
      <div className="absolute inset-x-4 bottom-4 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
    </div>
  );
}
