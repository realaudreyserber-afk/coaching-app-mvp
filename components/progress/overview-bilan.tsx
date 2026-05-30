"use client";

/**
 * Onglet "Bilan" de la page Suivi — tableau de bord visuel de tout ce que le coach
 * suit. Design inspiré de Samsung Health (cartes arrondies, anneaux de progression,
 * gros chiffres colorés par catégorie, sparklines), adapté au thème sombre de l'app.
 * Alimenté par /api/progress/overview.
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/firebase/hooks';

interface Overview {
  forme: { score: number | null; label: string; drivers: Array<{ label: string; ok: boolean }> } | null;
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
  series: {
    hydration: Array<{ date: string; ml: number }>;
    sleep: Array<{ date: string; hours: number }>;
    topLift: { name: string; points: Array<{ date: string; e1rm: number }> } | null;
  } | null;
}

/** Carte façon Samsung Health : coin arrondi, chip d'icône coloré, titre. */
function Card({ icon, title, color, children, wide }: { icon: string; title: string; color: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`rounded-2xl border border-zinc-800/80 bg-gradient-to-br from-zinc-900/80 to-zinc-900/30 p-4 ${wide ? 'sm:col-span-2 lg:col-span-1' : ''}`}>
      <div className="flex items-center gap-2.5 mb-3">
        <span className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}22` }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18, color }}>{icon}</span>
        </span>
        <h3 className="text-[13px] font-semibold text-zinc-200">{title}</h3>
      </div>
      {children}
    </div>
  );
}

/** Anneau de progression circulaire (SVG). */
function Ring({ pct, color, size = 96, stroke = 9, label, sub }: { pct: number; color: string; size?: number; stroke?: number; label: string; sub?: string }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, pct));
  const off = circ * (1 - clamped / 100);
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#27272a" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round" style={{ transition: 'stroke-dashoffset .6s ease' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold text-zinc-50 leading-none">{label}</span>
        {sub && <span className="text-[10px] text-zinc-500 mt-0.5">{sub}</span>}
      </div>
    </div>
  );
}

function Delta({ pct }: { pct: number | null }) {
  if (pct === null || pct === undefined) return null;
  const up = pct >= 0;
  return <span className={up ? 'text-emerald-400' : 'text-rose-400'} style={{ fontSize: 11 }}>{up ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%</span>;
}

/** Sparkline en barres. */
function Spark({ values, max = 10, color }: { values: Array<number | null>; max?: number; color: string }) {
  const pts = values.filter((v): v is number => v !== null);
  if (pts.length < 2) return <span className="text-zinc-600 text-[11px]">à venir…</span>;
  return (
    <div className="flex items-end gap-[3px] h-9">
      {values.slice(-14).map((v, i) => (
        <div key={i} title={v === null ? '—' : String(v)} style={{ width: 6, height: v === null ? 3 : `${Math.max(10, (v / max) * 100)}%`, background: v === null ? '#3f3f46' : color, borderRadius: 2, opacity: v === null ? 0.4 : 1 }} />
      ))}
    </div>
  );
}

/** Mini courbe (SVG) normalisée min-max — pour les tendances à baseline non nulle (force…). */
function MiniLine({ values, color, h = 30 }: { values: number[]; color: string; h?: number }) {
  if (values.length < 2) return <span className="text-zinc-600 text-[11px]">à venir…</span>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 100;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: h }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

const C = { force: '#f59e0b', sleep: '#818cf8', hydra: '#22d3ee', mood: '#34d399', body: '#2dd4bf', habit: '#fbbf24', subst: '#a1a1aa', cycle: '#f472b6', crave: '#fb923c' };
const MEASURE_LABELS: Record<string, string> = { waist_cm: 'Taille', neck_cm: 'Cou', hips_cm: 'Hanches', shoulder_cm: 'Épaules', chest_cm: 'Poitrine', arm_cm: 'Bras', thigh_cm: 'Cuisse', calf_cm: 'Mollet' };

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

  if (loading) return <p className="text-zinc-500 text-sm py-10 text-center">Chargement du bilan…</p>;
  if (!data) return <p className="text-zinc-500 text-sm py-10 text-center">Impossible de charger le bilan.</p>;
  return <OverviewBilanView data={data} />;
}

/** Vue présentationnelle (data en props) — réutilisable pour preview/test. */
export function OverviewBilanView({ data }: { data: Overview }) {
  const { forme, prs, sleep, hrv, hydration, habits, substances, cravings, measurements, cycle, subjective, series } = data;
  const formeColor = forme?.score == null ? '#71717a' : forme.score >= 60 ? '#34d399' : forme.score >= 40 ? '#f59e0b' : '#fb7185';
  const energy = subjective?.map((s) => s.energy) ?? [];
  const mood = subjective?.map((s) => s.mood) ?? [];
  const latestSubj = subjective && subjective.length ? subjective[subjective.length - 1] : null;
  const Hint = ({ children }: { children: React.ReactNode }) => (
    <p className="text-[13px] text-zinc-500 leading-snug">Vide — <span className="text-amber-400/90">{children}</span></p>
  );
  const hydraPct = hydration ? (hydration.today_effective_ml / Math.max(1, hydration.today_target_ml)) * 100 : 0;

  return (
    <div className="space-y-3">
      {/* HERO — Forme du jour (readiness, à la Samsung Energy Score) */}
      <div className="rounded-2xl border border-zinc-800/80 bg-gradient-to-br from-zinc-900 to-zinc-900/30 p-5 flex items-center gap-5">
        <Ring pct={forme?.score ?? 0} color={formeColor} size={116} stroke={11} label={forme?.score != null ? String(forme.score) : '—'} sub="/100" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500 font-mono mb-1">Forme du jour</p>
          <p className="text-xl font-bold" style={{ color: formeColor }}>{forme?.label ?? '—'}</p>
          {forme && forme.drivers.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {forme.drivers.map((d, i) => (
                <span key={i} className={`px-2 py-0.5 rounded-full text-[11px] ${d.ok ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>
                  {d.ok ? '✓' : '↓'} {d.label}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-zinc-500 mt-1.5">Logge ta récup (sommeil, HRV, hydratation) pour activer ton score.</p>
          )}
        </div>
      </div>

      {/* CARTES */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
        {/* HYDRATATION — anneau */}
      <Card icon="water_drop" title="Hydratation" color={C.hydra}>
        {hydration ? (
          <>
            <Ring pct={hydraPct} color={C.hydra} label={`${(hydration.today_effective_ml / 1000).toFixed(1)}L`} sub={`/ ${(hydration.today_target_ml / 1000).toFixed(1)}L`} />
            <p className="text-[11px] text-zinc-400 mt-2 text-center">Moy 7j {(hydration.avg_7day_ml / 1000).toFixed(1)}L · cible {hydration.days_target_hit_7day}/7</p>
            {series?.hydration && series.hydration.length >= 2 && (
              <div className="mt-2"><Spark values={series.hydration.map((d) => d.ml)} max={Math.max(hydration.today_target_ml, ...series.hydration.map((d) => d.ml))} color={C.hydra} /></div>
            )}
          </>
        ) : <Hint>« j&apos;ai bu 1,5 L »</Hint>}
      </Card>

      {/* HABITUDES — anneau */}
      <Card icon="task_alt" title="Habitudes" color={C.habit}>
        {habits && habits.habits_summary.length > 0 ? (
          <>
            <Ring pct={habits.adherence_7day_pct} color={C.habit} label={`${habits.adherence_7day_pct}%`} sub="7 jours" />
            <ul className="mt-2 space-y-0.5">
              {habits.habits_summary.slice(0, 3).map((h) => (
                <li key={h.name} className="flex items-center justify-between text-[11px]"><span className="text-zinc-400 truncate">{h.name}</span><span className="text-amber-400 shrink-0">🔥{h.current_streak}</span></li>
              ))}
            </ul>
          </>
        ) : <Hint>crée une habitude à suivre</Hint>}
      </Card>

      {/* RÉCUPÉRATION — gros chiffre */}
      <Card icon="bedtime" title="Récupération" color={C.sleep}>
        {sleep || hrv ? (
          <>
            {sleep && (
              <>
                <p className="text-3xl font-bold text-zinc-50 leading-none">{sleep.avg_hours_7day.toFixed(1)}<span className="text-base text-zinc-500 font-normal"> h</span></p>
                <p className="text-[11px] text-zinc-400 mt-1">moy/nuit · qualité {sleep.avg_quality_7day.toFixed(0)}/10 · {sleep.short_nights_7day} courte(s)</p>
              </>
            )}
            {hrv && hrv.avg_hrv_7day !== null && (
              <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-[11px] ${hrv.is_chronic_drift ? 'bg-rose-500/15 text-rose-300' : 'bg-emerald-500/15 text-emerald-300'}`}>
                HRV {hrv.avg_hrv_7day}ms · {hrv.is_chronic_drift ? 'fatigue' : 'stable'}
              </span>
            )}
            {series?.sleep && series.sleep.length >= 2 && (
              <div className="mt-2"><p className="text-[10px] text-zinc-500 mb-1">Sommeil · {series.sleep.length}j</p><Spark values={series.sleep.map((d) => d.hours)} max={9} color={C.sleep} /></div>
            )}
          </>
        ) : <Hint>« mal dormi, 6 h »</Hint>}
      </Card>

      {/* RESSENTI — sparklines (large) */}
      <Card icon="mood" title="Ressenti" color={C.mood} wide>
        {latestSubj ? (
          <div className="space-y-2.5">
            <div className="flex gap-1.5 flex-wrap">
              {latestSubj.energy != null && <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 text-[11px]">énergie {latestSubj.energy}/10</span>}
              {latestSubj.mood != null && <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 text-[11px]">humeur {latestSubj.mood}/10</span>}
              {latestSubj.hunger != null && <span className="px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-300 text-[11px]">faim {latestSubj.hunger}/10</span>}
            </div>
            <div><p className="text-[11px] text-zinc-500 mb-1">Énergie · 14j</p><Spark values={energy} color={C.mood} /></div>
            <div><p className="text-[11px] text-zinc-500 mb-1">Humeur · 14j</p><Spark values={mood} color={C.force} /></div>
          </div>
        ) : <Hint>« crevé, mal dormi »</Hint>}
      </Card>

      {/* FORCE — liste (large) */}
      <Card icon="exercise" title="Force · 1RM" color={C.force} wide>
        {prs && prs.top_exercises.length > 0 ? (
          <ul className="space-y-1.5">
            {prs.top_exercises.slice(0, 5).map((e) => (
              <li key={e.exercise_name} className="flex items-baseline justify-between gap-2">
                <span className="text-[13px] text-zinc-300 truncate">{e.exercise_name}</span>
                <span className="flex items-baseline gap-2 shrink-0"><span className="text-zinc-50 font-semibold">{e.current_1rm} kg</span><Delta pct={e.delta_90day_pct} /></span>
              </li>
            ))}
          </ul>
        ) : <Hint>« PR : 100 kg au développé couché »</Hint>}
        {series?.topLift && series.topLift.points.length >= 2 && (
          <div className="mt-3"><p className="text-[10px] text-zinc-500 mb-1">{series.topLift.name} · 1RM</p><MiniLine values={series.topLift.points.map((p) => p.e1rm)} color={C.force} /></div>
        )}
      </Card>

      {/* MENSURATIONS — liste (large) */}
      <Card icon="straighten" title="Mensurations" color={C.body} wide>
        {measurements && Object.keys(measurements.latest).length > 0 ? (
          <ul className="space-y-1.5">
            {Object.entries(measurements.latest).slice(0, 5).map(([k, v]) => (
              <li key={k} className="flex items-baseline justify-between gap-2">
                <span className="text-[13px] text-zinc-300">{MEASURE_LABELS[k] ?? k}</span>
                <span className="flex items-baseline gap-2"><span className="text-zinc-50 font-semibold">{v} cm</span>{measurements.delta_30day[k] && <Delta pct={measurements.delta_30day[k].pct} />}</span>
              </li>
            ))}
          </ul>
        ) : <Hint>« tour de taille 96, bras 38 »</Hint>}
      </Card>

      {/* Conditionnels */}
      {substances && (substances.avg_7day_caffeine_mg > 0 || substances.total_alcohol_7day > 0) && (
        <Card icon="local_cafe" title="Substances" color={C.subst}>
          <p className="text-[13px] text-zinc-300">Caféine <span className="text-zinc-50 font-semibold">{Math.round(substances.today_caffeine_mg)}mg</span></p>
          {substances.total_alcohol_7day > 0 && <p className="text-[11px] text-zinc-400 mt-1">Alcool {substances.total_alcohol_7day}u/7j</p>}
        </Card>
      )}
      {cycle?.current_phase && (
        <Card icon="cycle" title="Cycle" color={C.cycle}><p className="text-base font-semibold text-zinc-50 capitalize">{cycle.current_phase}</p></Card>
      )}
      {cravings && cravings.days_with_cravings_7day > 0 && (
        <Card icon="cookie" title="Fringales" color={C.crave}><p className="text-[13px] text-zinc-300">{cravings.days_with_cravings_7day}j/7 · {cravings.avg_intensity_7day.toFixed(1)}/10</p></Card>
      )}
      </div>
    </div>
  );
}
