import * as React from "react";

/**
 * Step Indicator — affiche "Étape X sur N" + barre de progression segmentée.
 * Stitch refs : onboarding-redesign-d.jpg (top-right "Étape 1 sur 6")
 */

interface StepIndicatorProps {
  current: number;
  total: number;
  className?: string;
}

export function StepIndicator({
  current,
  total,
  className = "",
}: StepIndicatorProps) {
  return (
    <div
      className={`flex flex-col items-end gap-2 ${className}`}
      role="progressbar"
      aria-valuenow={current}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-label={`Étape ${current} sur ${total}`}
    >
      <span className="text-[10px] uppercase tracking-widest font-semibold text-amber-500">
        Étape {current} sur {total}
      </span>
      <div className="flex gap-1 w-32">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              i + 1 <= current ? "bg-amber-500" : "bg-zinc-800"
            }`}
            aria-hidden="true"
          />
        ))}
      </div>
    </div>
  );
}
