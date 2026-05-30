"use client";

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { ExerciseFrLite } from '@/lib/features/exercises-fr';

interface Props {
  exercises: ExerciseFrLite[];
  categories: Array<{ category: string; count: number }>;
}

export function ExercisesBrowser({ exercises, categories }: Props) {
  const [cat, setCat] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [homeOnly, setHomeOnly] = useState(false);

  const homeCount = useMemo(() => exercises.filter((e) => e.home).length, [exercises]);

  const filtered = useMemo(() => {
    const nq = q.trim().toLowerCase();
    return exercises.filter(
      (e) =>
        (!cat || e.category === cat) &&
        (!homeOnly || e.home) &&
        (!nq || e.name.toLowerCase().includes(nq)),
    );
  }, [exercises, cat, q, homeOnly]);

  const chip = (active: boolean) =>
    `px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${
      active
        ? 'bg-amber-500 text-zinc-950 border-amber-500'
        : 'bg-zinc-900/60 text-zinc-300 border-zinc-700 hover:border-amber-500/50'
    }`;

  return (
    <div className="space-y-6">
      {/* Recherche */}
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Rechercher un exercice…"
        className="w-full sm:max-w-md rounded-lg bg-zinc-900/60 border border-zinc-700 px-4 py-2.5 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
      />

      {/* Toggle À la maison (filtre transversal, combinable avec le muscle) */}
      <button
        type="button"
        onClick={() => setHomeOnly((v) => !v)}
        aria-pressed={homeOnly}
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-semibold transition-colors ${
          homeOnly
            ? 'bg-emerald-500 text-zinc-950 border-emerald-500'
            : 'bg-zinc-900/60 text-zinc-200 border-zinc-700 hover:border-emerald-500/60'
        }`}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
          cottage
        </span>
        À la maison ({homeCount})
      </button>

      {/* Filtres catégorie */}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={chip(cat === null)} onClick={() => setCat(null)}>
          Tous ({exercises.length})
        </button>
        {categories.map((c) => (
          <button
            type="button"
            key={c.category}
            className={chip(cat === c.category)}
            onClick={() => setCat(c.category)}
          >
            {c.category} ({c.count})
          </button>
        ))}
      </div>

      {/* Grille */}
      <p className="text-xs text-zinc-500 font-mono uppercase tracking-wider">
        {filtered.length} exercice{filtered.length > 1 ? 's' : ''}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {filtered.map((e) => (
          <Link
            key={e.slug}
            href={`/exercices-musculation/${e.slug}`}
            className="group rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900/40 hover:border-amber-500/60 transition-colors"
          >
            <div className="aspect-[4/3] bg-zinc-800/60 overflow-hidden">
              {e.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={e.image}
                  alt={e.name}
                  loading="lazy"
                  className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-zinc-600">
                  <span className="material-symbols-outlined">fitness_center</span>
                </div>
              )}
            </div>
            <div className="p-3">
              <p className="text-sm font-semibold text-zinc-100 leading-tight line-clamp-2 group-hover:text-amber-300">
                {e.name}
              </p>
              <p className="mt-1 text-[11px] uppercase tracking-wider text-zinc-500 font-mono">
                {e.category}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-zinc-400 py-8 text-center">Aucun exercice ne correspond.</p>
      )}
    </div>
  );
}
