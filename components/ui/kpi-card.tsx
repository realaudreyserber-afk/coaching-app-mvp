import * as React from "react";
import { LucideIcon } from "lucide-react";
import { HudCard } from "@/components/nodream";

/**
 * KPI Card — NoDream Tactical OS look.
 * Glass hud-card + 4-bracket corners + mono numerals + gold/tech accent.
 * Used in Dashboard, Workout Summary, Progress.
 */

interface KPICardProps {
  label: string;
  value: string | number;
  unit?: string;
  delta?: number;
  deltaUnit?: string;
  deltaLabel?: string;
  /** `down-good` for fat loss, `up-good` for training volume */
  deltaDirection?: "down-good" | "up-good";
  icon?: LucideIcon;
  /** `gold` = primary HUD card, `tech` = matrix-green secondary */
  variant?: "default" | "gold" | "tech";
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
  const accent: "gold" | "tech" | "none" =
    variant === "gold" ? "gold" : variant === "tech" ? "tech" : "none";

  const numClass =
    variant === "gold"
      ? "stat-num gold"
      : variant === "tech"
        ? "stat-num tech"
        : "stat-num";

  const iconColor = variant === "tech" ? "var(--accent-tech)" : "var(--gold-500)";

  return (
    <HudCard
      accent={accent}
      corners
      chamfer="sm"
      className={`relative ${className}`}
      style={{ padding: "1rem 1.25rem" }}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className="eyebrow"
          style={{ color: iconColor }}
        >
          {label}
        </span>
        {Icon && (
          <Icon
            className="h-4 w-4 flex-shrink-0"
            style={{ color: iconColor }}
            aria-hidden="true"
          />
        )}
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span
          className={numClass}
          style={{ fontSize: "2.4rem", lineHeight: 1 }}
        >
          {value}
        </span>
        {unit && (
          <span
            className="mono"
            style={{
              fontSize: "0.85rem",
              color: "var(--fg-3)",
              letterSpacing: "0.05em",
            }}
          >
            {unit}
          </span>
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
    </HudCard>
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

  const color = isGood
    ? "var(--accent-tech)"
    : isBad
      ? "var(--alert-500)"
      : "var(--fg-4)";

  const sign = value > 0 ? "+" : "";

  return (
    <p
      className="mono mt-2"
      style={{
        fontSize: "0.7rem",
        letterSpacing: "0.1em",
        color,
      }}
    >
      <span style={{ fontWeight: 700 }}>
        {sign}
        {value}
        {unit ?? ""}
      </span>
      {label && (
        <span
          style={{ color: "var(--fg-5)", marginLeft: "0.5em" }}
        >
          {label}
        </span>
      )}
    </p>
  );
}
