import * as React from "react";
import { LucideIcon } from "lucide-react";

/**
 * KPI Card — affichage d'une métrique avec valeur, label, delta optionnel.
 * Utilisé dans Dashboard, Workout Summary, Progress.
 *
 * Stitch ref : dashboard-d.jpg, workout-summary-d.jpg
 */

interface KPICardProps {
  /** Label en haut (ex: "Poids actuel") */
  label: string;
  /** Valeur principale (ex: "85.4") */
  value: string | number;
  /** Unité affichée à côté de la valeur (ex: "kg", "kcal") */
  unit?: string;
  /** Delta par rapport à la période précédente (ex: -1.2, +120) */
  delta?: number;
  /** Unité du delta (ex: "kg", "%") */
  deltaUnit?: string;
  /** Label du delta (ex: "cette semaine") */
  deltaLabel?: string;
  /** Sens du delta : `down` est bon (perte de gras), `up` est bon (volume training) */
  deltaDirection?: "down-good" | "up-good";
  /** Icône Lucide affichée en haut à droite */
  icon?: LucideIcon;
  /** Variante visuelle : `default` = card standard, `gold` = bordure gold (KPI critique) */
  variant?: "default" | "gold";
  className?: string;
}

export function KPICard({
  label,
  value,
  unit,
  delta,
  deltaUnit,
  deltaLabel,
  deltaDirection = "down-good",
  icon: Icon,
  variant = "default",
  className = "",
}: KPICardProps) {
  const borderClass =
    variant === "gold"
      ? "border-amber-500/60"
      : "border-zinc-800";

  return (
    <div
      className={`relative p-4 sm:p-5 rounded-lg border ${borderClass} bg-zinc-900 ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-zinc-400">
          {label}
        </span>
        {Icon && (
          <Icon
            className="h-4 w-4 text-amber-500 flex-shrink-0"
            aria-hidden="true"
          />
        )}
      </div>

      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-2xl sm:text-3xl font-bold font-serif text-zinc-50 tabular-nums">
          {value}
        </span>
        {unit && (
          <span className="text-sm font-medium text-zinc-400">{unit}</span>
        )}
      </div>

      {delta !== undefined && (
        <DeltaBadge
          value={delta}
          unit={deltaUnit}
          label={deltaLabel}
          direction={deltaDirection}
        />
      )}
    </div>
  );
}

interface DeltaBadgeProps {
  value: number;
  unit?: string;
  label?: string;
  direction: "down-good" | "up-good";
}

function DeltaBadge({ value, unit, label, direction }: DeltaBadgeProps) {
  const isPositive = value > 0;
  const isNegative = value < 0;
  const isGood =
    (direction === "down-good" && isNegative) ||
    (direction === "up-good" && isPositive);
  const isBad =
    (direction === "down-good" && isPositive) ||
    (direction === "up-good" && isNegative);

  const colorClass = isGood
    ? "text-emerald-400"
    : isBad
      ? "text-red-400"
      : "text-zinc-400";

  const sign = value > 0 ? "+" : "";

  return (
    <p className={`mt-1.5 text-xs ${colorClass}`}>
      <span className="font-semibold tabular-nums">
        {sign}
        {value}
        {unit ?? ""}
      </span>
      {label && <span className="text-zinc-500 ml-1">{label}</span>}
    </p>
  );
}
