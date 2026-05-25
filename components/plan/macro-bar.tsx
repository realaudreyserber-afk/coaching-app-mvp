import * as React from "react";

/**
 * Macro Bar — affiche les 3 macros (protéines/glucides/lipides) avec une
 * progression horizontale chacune. Pour la sidebar "Objectifs du jour".
 *
 * Stitch ref : plan-d.jpg (sidebar avec Glucides 250g, Protéines 180g, Lipides 80g)
 */

interface MacroBarProps {
  /** Valeur en grammes pour ce macro */
  value: number;
  /** Cible en grammes (pour calculer le %) */
  target?: number;
  /** Label affiché à gauche */
  label: string;
  /** Couleur de la barre — default amber-500 */
  color?: string;
  className?: string;
}

export function MacroBar({
  value,
  target,
  label,
  color = "#f59e0b",
  className = "",
}: MacroBarProps) {
  const pct = target && target > 0
    ? Math.min(100, Math.round((value / target) * 100))
    : 100;

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-zinc-200">{label}</span>
        <span className="text-sm font-semibold text-zinc-50 tabular-nums">
          {value}
          <span className="text-xs text-zinc-400 ml-0.5">g</span>
          {target && (
            <span className="text-xs text-zinc-500 ml-1">/ {target}g</span>
          )}
        </span>
      </div>
      {target !== undefined ? (
        <div
          className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${label} : ${value} grammes sur ${target}`}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, backgroundColor: color }}
          />
        </div>
      ) : (
        // Sans cible : barre décorative dégradée gold (info-only, pas de progress)
        <div
          aria-hidden="true"
          className="h-1.5 w-full rounded-full bg-gradient-to-r from-amber-500/50 via-amber-500/20 to-transparent"
        />
      )}
    </div>
  );
}
