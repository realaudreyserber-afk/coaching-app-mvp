"use client";

import * as React from "react";
import Image from "next/image";
import { Pill } from "lucide-react";
import { StatPill } from "@/components/ui/stat-pill";

/**
 * Meal Card — affiche un repas avec photo (ou placeholder gold), nom, macros,
 * compléments associés et bouton "Ajouter" optionnel.
 *
 * Stitch refs : plan-d.jpg, plan-m.jpg, recipe-d.jpg
 */

export interface MealCardData {
  /** Nom du repas (ex: "Petit-déjeuner: Bol Avoine Doré aux Baies") */
  name: string;
  /** Description courte (ingrédients) */
  description?: string;
  /** Calories approximatives */
  approxKcal?: number;
  /** Macros en grammes */
  macros?: { p?: number; c?: number; f?: number };
  /** URL de la photo (placeholder gold-on-zinc si absent) */
  photoUrl?: string;
  /** Compléments à prendre avec ce repas */
  supplements?: Array<{ name: string; dosage: string }>;
}

interface MealCardProps {
  meal: MealCardData;
  /** Callback du bouton CTA */
  onAdd?: () => void;
  /** Label du bouton (default "Ajouter") */
  ctaLabel?: string;
  className?: string;
}

export function MealCard({
  meal,
  onAdd,
  ctaLabel = "Ajouter",
  className = "",
}: MealCardProps) {
  return (
    <article
      className={`group relative overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 transition-all hover:border-amber-500/40 ${className}`}
    >
      {/* Photo or placeholder */}
      <div className="relative aspect-[4/3] bg-zinc-800 overflow-hidden">
        {meal.photoUrl ? (
          <Image
            src={meal.photoUrl}
            alt={meal.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <MealPhotoPlaceholder name={meal.name} />
        )}
        {/* Subtle gold gradient at bottom for kcal badge readability */}
        {meal.approxKcal !== undefined && (
          <>
            <div
              aria-hidden="true"
              className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/80 to-transparent"
            />
            <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-zinc-950/80 text-amber-400 text-xs font-semibold tabular-nums border border-amber-500/30">
              ~{meal.approxKcal} kcal
            </span>
          </>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        <h3 className="text-base font-serif font-bold text-zinc-50 leading-tight">
          {meal.name}
        </h3>

        {meal.description && (
          <p className="text-xs text-zinc-400 leading-relaxed line-clamp-3">
            {meal.description}
          </p>
        )}

        {/* Macros */}
        {meal.macros && (
          <div className="flex flex-wrap gap-1.5">
            {meal.macros.p !== undefined && (
              <StatPill label="P" value={meal.macros.p} unit="g" />
            )}
            {meal.macros.c !== undefined && (
              <StatPill label="G" value={meal.macros.c} unit="g" />
            )}
            {meal.macros.f !== undefined && (
              <StatPill label="L" value={meal.macros.f} unit="g" />
            )}
          </div>
        )}

        {/* Supplements list */}
        {meal.supplements && meal.supplements.length > 0 && (
          <div className="pt-2 border-t border-zinc-800 space-y-1.5">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-500">
              <Pill className="h-3 w-3" aria-hidden="true" />
              <span>
                Complément{meal.supplements.length > 1 ? "s" : ""} avec ce repas
              </span>
            </div>
            <ul className="space-y-1">
              {meal.supplements.map((sup, idx) => (
                <li
                  key={idx}
                  className="flex justify-between items-center text-xs"
                >
                  <span className="text-zinc-200 font-medium">{sup.name}</span>
                  <span className="text-amber-400 font-semibold tabular-nums">
                    {sup.dosage}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* CTA */}
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            aria-label={`${ctaLabel} : ${meal.name}`}
            className="w-full mt-2 h-9 rounded-md bg-amber-500 text-zinc-950 text-sm font-semibold hover:bg-amber-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
          >
            {ctaLabel}
          </button>
        )}
      </div>
    </article>
  );
}

/**
 * Placeholder visuel pour les repas sans photo : gradient gold sur fond zinc
 * avec l'initiale du nom du repas en serif large.
 */
function MealPhotoPlaceholder({ name }: { name: string }) {
  const initial = name.replace(/^[^:]*:\s*/, "").charAt(0).toUpperCase() || "N";
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
