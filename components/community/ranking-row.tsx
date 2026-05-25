import * as React from "react";

/**
 * Ranking Row — une ligne du leaderboard complet (rang 4+).
 * Stitch ref : leaderboard-d.jpg (Global Rankings table)
 */

export interface RankingUser {
  rank: number;
  name: string;
  initials?: string;
  avatarUrl?: string;
  consistencyPct?: number;
  points: number;
}

interface RankingRowProps {
  user: RankingUser;
  /** Highlight si c'est l'utilisateur courant */
  isCurrentUser?: boolean;
  className?: string;
}

export function RankingRow({
  user,
  isCurrentUser = false,
  className = "",
}: RankingRowProps) {
  return (
    <li
      className={`grid grid-cols-[2rem_1fr_5rem_5rem] items-center gap-3 px-4 py-3 border-b border-zinc-800 last:border-0 text-sm transition-colors ${
        isCurrentUser
          ? "bg-amber-500/5 border-l-2 border-l-amber-500"
          : "hover:bg-zinc-800/40"
      } ${className}`}
      aria-current={isCurrentUser ? "true" : undefined}
    >
      <span
        className={`text-xs font-bold tabular-nums ${
          isCurrentUser ? "text-amber-400" : "text-zinc-400"
        }`}
        aria-label={`Rang ${user.rank}`}
      >
        {user.rank}.
      </span>

      <div className="flex items-center gap-2.5 min-w-0">
        <div className="h-7 w-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-[10px] font-semibold text-zinc-300">
              {user.initials || user.name.slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>
        <span
          className={`font-medium truncate ${
            isCurrentUser ? "text-zinc-50" : "text-zinc-200"
          }`}
        >
          {user.name}
        </span>
      </div>

      <span className="text-xs text-zinc-400 tabular-nums text-right">
        {user.consistencyPct !== undefined ? `${user.consistencyPct} %` : "—"}
      </span>

      <span
        className={`text-xs font-semibold tabular-nums text-right ${
          isCurrentUser ? "text-amber-400" : "text-zinc-200"
        }`}
      >
        {user.points.toLocaleString("fr-FR")}
      </span>
    </li>
  );
}
