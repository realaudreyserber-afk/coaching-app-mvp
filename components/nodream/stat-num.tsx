import React from 'react';

export interface StatNumProps {
  value: React.ReactNode;
  unit?: React.ReactNode;
  /** gold = big shimmer text-fill, tech = matrix neon, plain = no special treatment */
  accent?: 'gold' | 'tech' | 'plain';
  /** Eyebrow label above the value */
  label?: React.ReactNode;
  /** Delta text below the value (e.g. "-2.4 kg depuis le départ") */
  delta?: React.ReactNode;
  className?: string;
}

/**
 * Tactical big number — JetBrains Mono / Outfit Black.
 * Used in dashboard KPIs and detail cards.
 */
export function StatNum({ value, unit, accent = 'gold', label, delta, className = '' }: StatNumProps) {
  const valueClass = accent === 'tech' ? 'stat-num tech' : accent === 'gold' ? 'stat-num gold' : 'stat-num';
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <span className="eyebrow" style={{ color: accent === 'tech' ? 'var(--accent-tech)' : 'var(--gold-500)' }}>
          {label}
        </span>
      )}
      <div className="flex items-baseline gap-2">
        <span className={valueClass}>{value}</span>
        {unit && (
          <span
            className="mono"
            style={{ fontSize: '0.85rem', color: 'var(--fg-3)', letterSpacing: '0.05em' }}
          >
            {unit}
          </span>
        )}
      </div>
      {delta && (
        <span
          className="mono"
          style={{ fontSize: '0.7rem', letterSpacing: '0.1em', color: 'var(--fg-4)' }}
        >
          {delta}
        </span>
      )}
    </div>
  );
}
