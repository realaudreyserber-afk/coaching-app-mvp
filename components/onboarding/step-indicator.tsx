import * as React from "react";

/**
 * Step Indicator — NoDream Tactical OS.
 * Affiche "[STEP-X/Y]" en mono + databar segmentée or/transparent
 * + dot status pulsant sur le segment courant.
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
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    <div
      className={`flex flex-col items-end gap-2 ${className}`}
      role="progressbar"
      aria-valuenow={current}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-label={`Étape ${current} sur ${total}`}
    >
      <span
        className="mono"
        style={{
          fontSize: 10,
          letterSpacing: "0.3em",
          color: "var(--gold-500)",
          opacity: 0.9,
          textTransform: "uppercase",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span className="status-dot" aria-hidden="true" />
        [STEP-{pad(current)}/{pad(total)}]
      </span>
      <div className="flex gap-1" style={{ width: 144 }} aria-hidden="true">
        {Array.from({ length: total }).map((_, i) => {
          const done = i + 1 < current;
          const active = i + 1 === current;
          return (
            <div
              key={i}
              style={{
                flex: 1,
                height: 4,
                background: done
                  ? "var(--gold-500)"
                  : active
                  ? "var(--gold-400)"
                  : "var(--glass-bg-2)",
                border: `1px solid ${
                  done || active ? "var(--gold-tint-35)" : "var(--glass-border)"
                }`,
                boxShadow: active ? "var(--glow-gold-soft)" : "none",
                transition: "all 250ms ease",
                clipPath:
                  "polygon(2px 0, 100% 0, 100% calc(100% - 2px), calc(100% - 2px) 100%, 0 100%, 0 2px)",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
