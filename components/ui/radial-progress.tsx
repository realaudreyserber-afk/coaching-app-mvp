import * as React from "react";

/**
 * Radial Progress — anneau de progression circulaire avec valeur centrale.
 * Stitch ref : dashboard-d.jpg (Goal Progress radial 75%)
 */

interface RadialProgressProps {
  /** Valeur de 0 à 100 */
  value: number;
  /** Label affiché au-dessus de l'anneau */
  label?: string;
  /** Label affiché sous le pourcentage (ex: "complet", "3% to go") */
  subLabel?: string;
  /** Diamètre en pixels (default 160) */
  size?: number;
  /** Épaisseur du trait (default 8) */
  strokeWidth?: number;
  /** Couleur de progression (default gold) */
  color?: string;
  /** Couleur du trail (default zinc-800) */
  trailColor?: string;
  className?: string;
}

export function RadialProgress({
  value,
  label,
  subLabel,
  size = 160,
  strokeWidth = 8,
  color = "#d4a017",
  trailColor = "#27272a",
  className = "",
}: RadialProgressProps) {
  const clampedValue = Math.max(0, Math.min(100, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clampedValue / 100) * circumference;
  const center = size / 2;

  return (
    <div
      className={`inline-flex flex-col items-center gap-2 ${className}`}
      role="meter"
      aria-valuenow={clampedValue}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label || `Progression ${clampedValue}%`}
    >
      {label && (
        <span className="text-[10px] uppercase tracking-wider font-semibold text-zinc-400">
          {label}
        </span>
      )}
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="-rotate-90"
          aria-hidden="true"
        >
          {/* Trail */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            stroke={trailColor}
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Progress */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-[stroke-dashoffset] duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold font-serif text-zinc-50 tabular-nums">
            {clampedValue}%
          </span>
          {subLabel && (
            <span className="text-[10px] text-zinc-400 mt-0.5">{subLabel}</span>
          )}
        </div>
      </div>
    </div>
  );
}
