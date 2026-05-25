import * as React from "react";
import { Flame } from "lucide-react";

/**
 * Challenge Card — défi mensuel communautaire avec progress bar.
 * Stitch ref : leaderboard-d.jpg (Monthly Challenges sidebar gauche)
 */

interface ChallengeCardProps {
  title: string;
  /** Progression en % de complétion */
  progressPct: number;
  /** Sous-titre optionnel (ex: "12 jours restants") */
  subtitle?: string;
  /** État actif/terminé */
  active?: boolean;
  className?: string;
}

export function ChallengeCard({
  title,
  progressPct,
  subtitle,
  active = true,
  className = "",
}: ChallengeCardProps) {
  const pct = Math.max(0, Math.min(100, progressPct));

  return (
    <article
      className={`p-3 rounded-md border border-zinc-800 bg-zinc-900 space-y-2 ${
        active ? "" : "opacity-60"
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Flame
            className={`h-3.5 w-3.5 flex-shrink-0 ${active ? "text-amber-500" : "text-zinc-500"}`}
            aria-hidden="true"
          />
          <h4 className="text-sm font-serif font-semibold text-zinc-100 truncate">
            {title}
          </h4>
        </div>
        <span
          className={`text-xs font-semibold tabular-nums ${
            active ? "text-amber-400" : "text-zinc-500"
          }`}
        >
          {pct} %
        </span>
      </div>

      <div
        className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${title} : ${pct}%`}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            active ? "bg-amber-500" : "bg-zinc-600"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {subtitle && (
        <p className="text-[10px] text-zinc-500">{subtitle}</p>
      )}
    </article>
  );
}
