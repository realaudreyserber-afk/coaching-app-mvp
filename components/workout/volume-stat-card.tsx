import * as React from "react";
import { LucideIcon } from "lucide-react";

/**
 * Volume Stat Card — KPI radial-style avec icône gold + valeur + label.
 * Stitch ref : workout-summary-d.jpg (3 cards Volume/Time/PRs)
 */

interface VolumeStatCardProps {
  /** Label en haut (ex: "Volume", "Temps", "Records") */
  label: string;
  /** Valeur principale (ex: "12 450", "1h 15m", "3") */
  value: string | number;
  /** Unité (ex: "kg", "récords") */
  unit?: string;
  /** Icône Lucide */
  icon: LucideIcon;
  /** Variante : `gold` = bordure et icône gold, `default` = subtil */
  variant?: "gold" | "default";
  className?: string;
}

export function VolumeStatCard({
  label,
  value,
  unit,
  icon: Icon,
  variant = "gold",
  className = "",
}: VolumeStatCardProps) {
  const isGold = variant === "gold";

  return (
    <article
      className={`relative flex flex-col items-center text-center gap-3 p-6 rounded-full aspect-square border-2 ${
        isGold ? "border-amber-500 bg-zinc-900" : "border-zinc-700 bg-zinc-900"
      } ${className}`}
    >
      <Icon
        className={`h-7 w-7 ${isGold ? "text-amber-500" : "text-zinc-400"}`}
        aria-hidden="true"
      />
      <span className="text-[10px] uppercase tracking-widest font-semibold text-zinc-400">
        {label}
      </span>
      <div className="flex flex-col items-center">
        <span className="text-2xl sm:text-3xl font-bold font-serif text-zinc-50 tabular-nums leading-none">
          {value}
        </span>
        {unit && (
          <span className="text-xs text-zinc-400 mt-1 uppercase tracking-wider">
            {unit}
          </span>
        )}
      </div>
    </article>
  );
}
