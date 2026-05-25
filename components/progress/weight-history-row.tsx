import * as React from "react";
import { Calendar } from "lucide-react";

/**
 * Weight History Row — une ligne de l'historique des pesées quotidiennes.
 * Affiche la date FR + le poids + le delta par rapport à la pesée précédente.
 *
 * Stitch ref : progress-d.jpg (sidebar droite "Historique Journalier")
 */

interface WeightHistoryRowProps {
  /** Timestamp ISO de la pesée */
  createdAt: string;
  /** Poids en kg */
  weight: number;
  /** Delta par rapport à la pesée précédente (en kg). Undefined si pas de précédente. */
  delta?: number;
  className?: string;
}

export function WeightHistoryRow({
  createdAt,
  weight,
  delta,
  className = "",
}: WeightHistoryRowProps) {
  const date = new Date(createdAt);
  const dateLabel = date.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  return (
    <li
      className={`flex justify-between items-center px-4 py-3 hover:bg-zinc-800/40 transition-colors text-xs ${className}`}
    >
      <div className="flex items-center gap-2">
        <Calendar className="h-3.5 w-3.5 text-zinc-500" aria-hidden="true" />
        <time
          dateTime={createdAt}
          className="font-medium text-zinc-100"
        >
          {dateLabel}
        </time>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-bold text-zinc-50 text-sm tabular-nums">
          {weight.toFixed(1)}{" "}
          <span className="text-xs font-normal text-zinc-400">kg</span>
        </span>
        <DeltaBadge delta={delta} />
      </div>
    </li>
  );
}

function DeltaBadge({ delta }: { delta?: number }) {
  if (delta === undefined) {
    return (
      <span
        className="text-[10px] text-zinc-500 tabular-nums w-12 text-right"
        aria-label="Pas de pesée précédente"
      >
        —
      </span>
    );
  }
  if (delta === 0) {
    return (
      <span
        className="text-[10px] text-zinc-500 tabular-nums w-12 text-right"
        aria-label="Variation nulle"
      >
        0
      </span>
    );
  }
  const isLoss = delta < 0;
  return (
    <span
      className={`text-[10px] font-bold tabular-nums w-12 text-right ${
        isLoss ? "text-emerald-400" : "text-amber-400"
      }`}
      aria-label={`Variation ${isLoss ? "perte" : "prise"} de ${Math.abs(delta).toFixed(1)} kg`}
    >
      {delta > 0 ? "+" : ""}
      {delta.toFixed(1)}
    </span>
  );
}
