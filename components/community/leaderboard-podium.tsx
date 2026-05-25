import * as React from "react";
import { Award, Medal, Trophy } from "lucide-react";

/**
 * Leaderboard Podium — Top 3 du classement avec médailles or/argent/bronze.
 * Stitch ref : leaderboard-d.jpg (top 3 elite Marco/Elena/Anya avec badges)
 */

export interface PodiumUser {
  rank: 1 | 2 | 3;
  name: string;
  /** Initiales pour l'avatar placeholder (ex: "M.R") */
  initials?: string;
  /** Photo profil (optionnel) */
  avatarUrl?: string;
  /** Statistique principale (ex: "Consistency 99 %") */
  stat?: string;
  /** Points cumulés */
  points?: number;
  /** Tier label (ex: "Gold Tier") */
  tier?: string;
}

interface LeaderboardPodiumProps {
  /** 1er, 2e, 3e (l'ordre n'importe pas — le composant trie par rank) */
  users: PodiumUser[];
  className?: string;
}

const RANK_META = {
  1: {
    icon: Trophy,
    color: "text-amber-400",
    bg: "bg-amber-500/15",
    border: "border-amber-500",
    label: "Or",
    size: "lg" as const,
  },
  2: {
    icon: Medal,
    color: "text-zinc-300",
    bg: "bg-zinc-700/40",
    border: "border-zinc-500",
    label: "Argent",
    size: "md" as const,
  },
  3: {
    icon: Award,
    color: "text-amber-700",
    bg: "bg-amber-900/30",
    border: "border-amber-800",
    label: "Bronze",
    size: "md" as const,
  },
};

export function LeaderboardPodium({
  users,
  className = "",
}: LeaderboardPodiumProps) {
  // Order: 2 - 1 - 3 (style podium : argent gauche, or centre, bronze droite)
  const sorted = [...users].sort((a, b) => a.rank - b.rank);
  const ordered = [
    sorted.find((u) => u.rank === 2),
    sorted.find((u) => u.rank === 1),
    sorted.find((u) => u.rank === 3),
  ].filter(Boolean) as PodiumUser[];

  return (
    <div
      className={`grid grid-cols-3 gap-3 sm:gap-6 items-end ${className}`}
      role="list"
      aria-label="Podium top 3 du classement"
    >
      {ordered.map((user) => {
        const meta = RANK_META[user.rank];
        const Icon = meta.icon;
        const isTop = user.rank === 1;

        return (
          <article
            key={user.rank}
            role="listitem"
            className={`flex flex-col items-center text-center gap-2 p-4 rounded-lg border ${meta.border} ${meta.bg} ${
              isTop ? "lg:scale-110 lg:py-6" : ""
            }`}
          >
            <div
              className={`relative h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-zinc-800 border-2 ${meta.border} flex items-center justify-center font-serif font-bold text-zinc-100`}
            >
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full rounded-full object-cover"
                />
              ) : (
                <span className="text-base sm:text-lg">
                  {user.initials || user.name.slice(0, 2).toUpperCase()}
                </span>
              )}
              <span
                className={`absolute -bottom-1 -right-1 h-6 w-6 rounded-full ${meta.bg} ${meta.color} border-2 border-zinc-950 flex items-center justify-center`}
                aria-label={`${meta.label}, rang ${user.rank}`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            </div>

            <div className="space-y-0.5 min-w-0 w-full">
              <p className={`font-serif font-bold text-sm sm:text-base truncate ${isTop ? "text-zinc-50" : "text-zinc-200"}`}>
                {user.name}
              </p>
              {user.tier && (
                <p className={`text-[10px] uppercase tracking-wider font-semibold ${meta.color}`}>
                  {user.tier}
                </p>
              )}
              {user.stat && (
                <p className="text-xs text-zinc-400 tabular-nums">{user.stat}</p>
              )}
              {user.points !== undefined && (
                <p className={`text-xs font-semibold tabular-nums ${meta.color}`}>
                  {user.points.toLocaleString("fr-FR")} pts
                </p>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
