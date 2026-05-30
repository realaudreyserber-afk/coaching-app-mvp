"use client";

/**
 * Onglet "Bilan" de la page Suivi — donne à l'utilisateur le VISUEL de tout ce
 * que le coach suit (force/PRs, récup sommeil+HRV, hydratation, ressenti,
 * habitudes, substances, cravings, cycle). Alimenté par /api/progress/overview.
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/firebase/hooks';

interface Overview {
  prs: { top_exercises: Array<{ exercise_name: string; current_1rm: number; delta_90day_pct: number | null }>; n_exercises_tracked: number } | null;
  sleep: { avg_hours_7day: number; avg_quality_7day: number; short_nights_7day: number; logs_count_7day: number } | null;
  hrv: { avg_hrv_7day: number | null; baseline_drift_pct: number | null; is_chronic_drift: boolean; logs_count_7day: number } | null;
  hydration: { today_effective_ml: number; today_target_ml: number; avg_7day_ml: number; days_target_hit_7day: number } | null;
  habits: { adherence_7day_pct: number; habits_summary: Array<{ name: string; current_streak: number }> } | null;
  substances: { today_caffeine_mg: number; avg_7day_caffeine_mg: number; total_alcohol_7day: number; drinking_days_7day: number } | null;
  cravings: { days_with_cravings_7day: number; avg_intensity_7day: number } | null;
  measurements: { latest: Record<string, number>; delta_30day: Record<string, { abs_cm: number; pct: number }> } | null;
  cycle: { current_phase?: string } | null;
  subjective: Array<{ date: string; energy: number | null; mood: number | null; hunger: number | null; sleep_hours: number | null }> | null;
}

function Card({ icon, title, accent, children }: { icon: string; title: string; accent?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="material-symbols-outlined" style={{ fontSize: 18, color: accent ?? '#f59e0b' }}>{icon}</span>
        <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-zinc-300 font-mono">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Delta({ pct }: { pct: number | null }) {
  if (pct === null || pct === undefined) return null;
  const up = pct >= 0;
  return (
    <span className={up ? 'text-emerald-400' : 'text-red-400'} style={{ fontSize: 12 }}>
      {up ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

/** Mini sparkline en barres (valeurs sur échelle [min,max]). */
function Spark({ values, max = 10, color = '#f59e0b' }: { values: Array<number | null>; max?: number; color?: string }) {
  const pts = values.filter((v): v is number => v !== null);
  if (pts.length < 2) return <span className="text-zinc-600 text-xs">pas assez de données</span>;
  return (
    <div className="flex items-end gap-0.5 h-8">
      {values.slice(-14).map((v, i) => (
        <div
          key={i}
          title={v === null ? '—' : String(v)}
          style={{
            width: 6,
            height: v === null ? 2 : `${Math.max(8, (v / max) * 100)}%`,
            background: v === null ? '#3f3f46' : color,
            borderRadius: 1,
            opacity: v === null ? 0.4 : 1,
          }}
        />
      ))}
    </div>
  );
}

const MEASURE_LABELS: Record<string, string> = {
  waist_cm: 'Taille', neck_cm: 'Cou', hips_cm: 'Hanches', shoulder_cm: 'Épaules',
  chest_cm: 'Poitrine', arm_cm: 'Bras', thigh_cm: 'Cuisse', calf_cm: 'Mollet',
};

export function OverviewBilan() {
  const { getFreshToken } = useAuth();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getFreshToken();
        if (!token) return;
        const res = await fetch('/api/progress/overview', { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch { /* */ } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [getFreshToken]);

  if (loading) return <p className="text-zinc-500 text-sm py-8 text-center">Chargement du bilan…</p>;
  if (!data) return <p className="text-zinc-500 text-sm py-8 text-center">Impossible de charger le bilan.</p>;

  const { prs, sleep, hrv, hydration, habits, substances, cravings, measurements, cycle, subjective } = data;
  const energy = subjective?.map((s) => s.energy) ?? [];
  const mood = subjective?.map((s) => s.mood) ?? [];
  const latestSubj = subjective && subjective.length ? subjective[subjective.length - 1] : null;
  const Hint = ({ children }: { children: React.ReactNode }) => (
    <p className="text-sm text-zinc-500 leading-snug">
      Aucune donnée — <span className="text-amber-400">{children}</span>
    </p>
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {/* FORCE — toujours visible */}
      <Card icon="exercise" title="Force — 1RM">
        {prs && prs.top_exercises.length > 0 ? (
          <ul className="space-y-2">
            {prs.top_exercises.slice(0, 5).map((e) => (
              <li key={e.exercise_name} className="flex items-baseline justify-between gap-2">
                <span className="text-sm text-zinc-300 truncate">{e.exercise_name}</span>
                <span className="flex items-baseline gap-2 shrink-0">
                  <span className="text-zinc-100 font-semibold">{e.current_1rm} kg</span>
                  <Delta pct={e.delta_90day_pct} />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <Hint>dis « PR : 100 kg au développé couché » au coach</Hint>
        )}
      </Card>

      {/* RÉCUPÉRATION — toujours visible */}
      <Card icon="bedtime" title="Récupération" accent="#a78bfa">
        {sleep || hrv ? (
          <>
            {sleep && (
              <div className="mb-2">
                <p className="text-2xl font-bold text-zinc-100">{sleep.avg_hours_7day.toFixed(1)} h<span className="text-sm text-zinc-500 font-normal"> /nuit (7j)</span></p>
                <p className="text-xs text-zinc-400">Qualité {sleep.avg_quality_7day.toFixed(0)}/10 · {sleep.short_nights_7day} nuit(s) courte(s)</p>
              </div>
            )}
            {hrv && hrv.avg_hrv_7day !== null && (
              <p className="text-xs">
                HRV {hrv.avg_hrv_7day} ms ·{' '}
                <span className={hrv.is_chronic_drift ? 'text-red-400' : 'text-emerald-400'}>
                  {hrv.is_chronic_drift ? 'fatigue cumulée' : 'stable'}
                </span>
              </p>
            )}
          </>
        ) : (
          <Hint>dis « mal dormi, 6 h » au coach (ou fais ton check-in du jour)</Hint>
        )}
      </Card>

      {/* HYDRATATION — toujours visible */}
      <Card icon="water_drop" title="Hydratation" accent="#38bdf8">
        {hydration ? (
          <>
            <p className="text-2xl font-bold text-zinc-100">
              {(hydration.today_effective_ml / 1000).toFixed(1)} L
              <span className="text-sm text-zinc-500 font-normal"> / {(hydration.today_target_ml / 1000).toFixed(1)} L</span>
            </p>
            <div className="mt-2 h-2 rounded-full bg-zinc-800 overflow-hidden">
              <div className="h-full bg-sky-400" style={{ width: `${Math.min(100, (hydration.today_effective_ml / Math.max(1, hydration.today_target_ml)) * 100)}%` }} />
            </div>
            <p className="text-xs text-zinc-400 mt-1.5">Moy. 7j : {(hydration.avg_7day_ml / 1000).toFixed(1)} L · cible atteinte {hydration.days_target_hit_7day}/7</p>
          </>
        ) : (
          <Hint>dis « j&apos;ai bu 1,5 L » au coach</Hint>
        )}
      </Card>

      {/* RESSENTI — toujours visible */}
      <Card icon="mood" title="Ressenti" accent="#34d399">
        {latestSubj ? (
          <div className="space-y-2">
            <p className="text-xs text-zinc-400">
              Dernier : énergie {latestSubj.energy ?? '—'}/10 · humeur {latestSubj.mood ?? '—'}/10 · faim {latestSubj.hunger ?? '—'}/10
            </p>
            <div><p className="text-xs text-zinc-500 mb-1">Énergie (14j)</p><Spark values={energy} max={10} color="#34d399" /></div>
            <div><p className="text-xs text-zinc-500 mb-1">Humeur (14j)</p><Spark values={mood} max={10} color="#f59e0b" /></div>
          </div>
        ) : (
          <Hint>dis « crevé, mal dormi » au coach</Hint>
        )}
      </Card>

      {/* MENSURATIONS — toujours visible */}
      <Card icon="straighten" title="Mensurations" accent="#22d3ee">
        {measurements && Object.keys(measurements.latest).length > 0 ? (
          <ul className="space-y-1.5">
            {Object.entries(measurements.latest).slice(0, 5).map(([k, v]) => (
              <li key={k} className="flex items-baseline justify-between gap-2">
                <span className="text-sm text-zinc-300">{MEASURE_LABELS[k] ?? k}</span>
                <span className="flex items-baseline gap-2">
                  <span className="text-zinc-100 font-semibold">{v} cm</span>
                  {measurements.delta_30day[k] && <Delta pct={measurements.delta_30day[k].pct} />}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <Hint>dis « tour de taille 96, bras 38 » au coach</Hint>
        )}
      </Card>

      {/* HABITUDES */}
      {habits && habits.habits_summary.length > 0 && (
        <Card icon="task_alt" title="Habitudes" accent="#fbbf24">
          <p className="text-2xl font-bold text-zinc-100">{habits.adherence_7day_pct}%<span className="text-sm text-zinc-500 font-normal"> assiduité 7j</span></p>
          <ul className="mt-2 space-y-1">
            {habits.habits_summary.slice(0, 4).map((h) => (
              <li key={h.name} className="flex items-center justify-between text-sm">
                <span className="text-zinc-300 truncate">{h.name}</span>
                <span className="text-amber-400 shrink-0">🔥 {h.current_streak}j</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* SUBSTANCES */}
      {substances && (substances.avg_7day_caffeine_mg > 0 || substances.total_alcohol_7day > 0) && (
        <Card icon="local_cafe" title="Substances" accent="#d4d4d8">
          <p className="text-sm text-zinc-300">Caféine : <span className="text-zinc-100 font-semibold">{Math.round(substances.today_caffeine_mg)} mg</span> auj. (moy {Math.round(substances.avg_7day_caffeine_mg)} mg)</p>
          {substances.total_alcohol_7day > 0 && (
            <p className="text-sm text-zinc-300 mt-1">Alcool : {substances.total_alcohol_7day} u. sur 7j ({substances.drinking_days_7day} j)</p>
          )}
        </Card>
      )}

      {/* CYCLE */}
      {cycle?.current_phase && (
        <Card icon="cycle" title="Cycle" accent="#f472b6">
          <p className="text-lg font-semibold text-zinc-100 capitalize">{cycle.current_phase}</p>
        </Card>
      )}

      {/* CRAVINGS */}
      {cravings && cravings.days_with_cravings_7day > 0 && (
        <Card icon="cookie" title="Fringales" accent="#fb923c">
          <p className="text-sm text-zinc-300">{cravings.days_with_cravings_7day} jour(s)/7 · intensité moy. {cravings.avg_intensity_7day.toFixed(1)}/10</p>
        </Card>
      )}
    </div>
  );
}
