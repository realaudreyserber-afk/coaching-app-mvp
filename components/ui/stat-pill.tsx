import * as React from "react";

/**
 * Stat Pill — petit badge value + unit, pour afficher des macros/kcal en ligne.
 * Stitch refs : plan-d.jpg (macros sur meal cards), recipe-d.jpg (chips macros)
 */

type StatPillVariant = "default" | "gold" | "subtle";

interface StatPillProps {
  /** Valeur principale (ex: "180g", "450 kcal") */
  value: string | number;
  /** Label optionnel à côté (ex: "P", "Protéines") */
  label?: string;
  /** Unité affichée après la valeur (ex: "g", "kcal") */
  unit?: string;
  variant?: StatPillVariant;
  className?: string;
}

const VARIANT_CLASS: Record<StatPillVariant, string> = {
  default: "bg-zinc-800 border-zinc-700 text-zinc-100",
  gold: "bg-amber-500/10 border-amber-500/40 text-amber-400",
  subtle: "bg-transparent border-zinc-700/60 text-zinc-300",
};

export function StatPill({
  value,
  label,
  unit,
  variant = "default",
  className = "",
}: StatPillProps) {
  return (
    <span
      className={`inline-flex items-baseline gap-1 px-2 py-0.5 rounded-md border text-xs font-medium tabular-nums ${VARIANT_CLASS[variant]} ${className}`}
    >
      {label && (
        <span className="text-[10px] uppercase tracking-wider font-semibold opacity-70">
          {label}
        </span>
      )}
      <span className="font-semibold">{value}</span>
      {unit && <span className="text-[10px] opacity-70">{unit}</span>}
    </span>
  );
}
