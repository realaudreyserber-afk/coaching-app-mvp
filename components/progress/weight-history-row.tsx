import * as React from "react";
import { Calendar } from "lucide-react";

/**
 * Weight History Row — NoDream Tactical OS.
 * Ligne mono avec date FR + poids tabular-nums + delta tech/gold.
 */

interface WeightHistoryRowProps {
  createdAt: string;
  weight: number;
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
      className={`flex justify-between items-center transition-colors ${className}`}
      style={{
        padding: '10px 4px',
        borderBottom: '1px solid var(--glass-border)',
        fontSize: 12,
      }}
    >
      <div className="flex items-center gap-2">
        <Calendar
          className="h-3 w-3"
          style={{ color: 'var(--fg-5)' }}
          aria-hidden="true"
        />
        <time
          dateTime={createdAt}
          className="mono"
          style={{
            color: 'var(--fg-2)',
            fontSize: 11,
            letterSpacing: '0.04em',
            textTransform: 'capitalize',
          }}
        >
          {dateLabel}
        </time>
      </div>
      <div className="flex items-center gap-3">
        <span
          className="mono tabular-nums"
          style={{
            color: 'var(--fg-1)',
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '0.02em',
          }}
        >
          {weight.toFixed(1)}
          <span style={{ fontSize: 9, color: 'var(--fg-5)', marginLeft: 3 }}>kg</span>
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
        className="mono tabular-nums text-right"
        style={{
          fontSize: 10,
          color: 'var(--fg-5)',
          width: 48,
        }}
        aria-label="Pas de pesée précédente"
      >
        —
      </span>
    );
  }
  if (delta === 0) {
    return (
      <span
        className="mono tabular-nums text-right"
        style={{
          fontSize: 10,
          color: 'var(--fg-5)',
          width: 48,
        }}
        aria-label="Variation nulle"
      >
        0
      </span>
    );
  }
  const isLoss = delta < 0;
  return (
    <span
      className="mono tabular-nums text-right"
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.04em',
        color: isLoss ? 'var(--accent-tech)' : 'var(--gold-400)',
        width: 48,
      }}
      aria-label={`Variation ${isLoss ? "perte" : "prise"} de ${Math.abs(delta).toFixed(1)} kg`}
    >
      {delta > 0 ? "+" : ""}
      {delta.toFixed(1)}
    </span>
  );
}
