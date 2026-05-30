"use client";

/**
 * Primitives de visualisation de la page Suivi — re-tokenisées dans le langage
 * "Tactical OS" (tokens gold / accent-tech / fg / glass, police mono,
 * angles chamfrés). Réutilisées telles quelles (pas de primitive SVG net-new) :
 * Ring / Spark / MiniLine / MultiLine / Delta + Section (HudCard + PanelHeader)
 * et Hint (état vide pédagogique). Partagées par app/(app)/progress/page.tsx.
 */

import React from 'react';
import { HudCard, PanelHeader } from '@/components/nodream';

/** Réponse de /api/progress/overview consommée par la page Suivi. */
export interface Overview {
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
    lifts?: Record<string, Array<{ date: string; e1rm: number }>>;
    measure?: Record<string, Array<{ date: string; cm: number }>>;
  } | null;
  weight: { current: number; delta_kg: number; delta_pct: number | null; points: Array<{ date: string; kg: number }> } | null;
  photos: { count: number; latest: { date: string; face?: string; profile?: string; back?: string } | null } | null;
}

/** Couleurs sémantiques limitées à 2 accents + alerte (palette Tactical OS). */
export const HUD = {
  gold: 'var(--gold-400)', // corps / poids / force / habitudes
  tech: 'var(--accent-tech)', // process / récup / hydratation / ressenti
  alert: 'var(--alert-500)',
  track: 'var(--glass-border)',
};

export const LIFT_META: Record<string, { label: string; color: string }> = {
  squat: { label: 'Squat', color: HUD.gold },
  bench: { label: 'Développé couché', color: HUD.tech },
  deadlift: { label: 'Soulevé de terre', color: HUD.gold },
};

export const MEASURE_LABELS: Record<string, string> = {
  waist_cm: 'Taille', neck_cm: 'Cou', hips_cm: 'Hanches', shoulder_cm: 'Épaules',
  chest_cm: 'Poitrine', arm_cm: 'Bras', thigh_cm: 'Cuisse', calf_cm: 'Mollet',
};

/** Anneau de progression circulaire (SVG), chiffre central en stat-num. */
export function Ring({ pct, color, size = 96, stroke = 9, label, sub }: { pct: number; color: string; size?: number; stroke?: number; label: string; sub?: string }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, pct));
  const off = circ * (1 - clamped / 100);
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} style={{ stroke: HUD.track }} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round" style={{ stroke: color, transition: 'stroke-dashoffset .6s ease' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="stat-num" style={{ fontSize: size >= 110 ? 24 : 18, lineHeight: 1 }}>{label}</span>
        {sub && <span className="mono" style={{ fontSize: 10, color: 'var(--fg-4)', marginTop: 2 }}>{sub}</span>}
      </div>
    </div>
  );
}

/** Delta directionnel : baisse → tech (froid), hausse → or (chaud). Neutre (pas bien/mal). */
export function Delta({ value, unit = '%' }: { value: number | null | undefined; unit?: string }) {
  if (value === null || value === undefined) return null;
  const up = value >= 0;
  const color = up ? HUD.gold : HUD.tech;
  return <span className="mono" style={{ fontSize: 11, color, letterSpacing: '0.04em' }}>{up ? '▲' : '▼'} {up ? '+' : ''}{value.toFixed(1)}{unit}</span>;
}

/** Sparkline en barres (angles nets HUD). */
export function Spark({ values, max = 10, color, h = 36 }: { values: Array<number | null>; max?: number; color: string; h?: number }) {
  const pts = values.filter((v): v is number => v !== null);
  if (pts.length < 2) return <span className="mono" style={{ fontSize: 11, color: 'var(--fg-5)' }}>à venir…</span>;
  return (
    <div className="flex items-end gap-[3px]" style={{ height: h }}>
      {values.slice(-14).map((v, i) => (
        <div key={i} title={v === null ? '—' : String(v)} style={{ flex: 1, minWidth: 4, height: v === null ? 3 : `${Math.max(10, (v / max) * 100)}%`, background: v === null ? HUD.track : color, opacity: v === null ? 0.4 : 1 }} />
      ))}
    </div>
  );
}

/** Mini courbe (SVG) normalisée min-max. markEnds = pastille départ + actuel. */
export function MiniLine({ values, color, h = 30, markEnds = false }: { values: number[]; color: string; h?: number; markEnds?: boolean }) {
  if (values.length < 2) return <span className="mono" style={{ fontSize: 11, color: 'var(--fg-5)' }}>à venir…</span>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 100;
  const coords = values.map((v, i) => ({ x: (i / (values.length - 1)) * w, y: h - ((v - min) / range) * (h - 4) - 2 }));
  const svg = (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: h }}>
      <polyline points={coords.map((c) => `${c.x},${c.y}`).join(' ')} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" style={{ stroke: color }} />
    </svg>
  );
  if (!markEnds) return svg;
  const dot = (c: { x: number; y: number }): React.CSSProperties => ({ position: 'absolute', left: `${c.x}%`, top: `${(c.y / h) * 100}%`, width: 7, height: 7, marginLeft: -3.5, marginTop: -3.5, background: color, boxShadow: '0 0 0 2px var(--ink-900)' });
  return (
    <div className="relative" style={{ height: h }}>
      {svg}
      <span style={dot(coords[0])} />
      <span style={dot(coords[coords.length - 1])} />
    </div>
  );
}

/** Multi-courbe temporelle (séries partageant l'axe) + légende. Pour les 3 gros lifts. */
export function MultiLine({ series, h = 130, legend = true }: { series: Array<{ label: string; color: string; unit?: string; points: Array<{ date: string; value: number }> }>; h?: number; legend?: boolean }) {
  const all = series.flatMap((s) => s.points);
  if (all.length < 2) return <span className="mono" style={{ fontSize: 11, color: 'var(--fg-5)' }}>à venir…</span>;
  const ts = all.map((p) => Date.parse(p.date));
  const vs = all.map((p) => p.value);
  const tmin = Math.min(...ts), tspan = Math.max(...ts) - tmin || 1;
  const vmin = Math.min(...vs), vspan = Math.max(...vs) - vmin || 1;
  const W = 100, pad = 6;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: h }}>
        {series.filter((s) => s.points.length >= 2).map((s) => (
          <polyline key={s.label} points={s.points.map((p) => `${((Date.parse(p.date) - tmin) / tspan) * W},${h - ((p.value - vmin) / vspan) * (h - 2 * pad) - pad}`).join(' ')} fill="none" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" style={{ stroke: s.color }} />
        ))}
      </svg>
      {legend && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
          {series.filter((s) => s.points.length).map((s) => (
            <span key={s.label} className="mono flex items-center gap-1" style={{ fontSize: 11, color: 'var(--fg-3)' }}>
              <span style={{ width: 8, height: 8, background: s.color }} />{s.label} <span style={{ color: 'var(--fg-1)' }}>{s.points[s.points.length - 1].value}{s.unit ?? ''}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** État vide pédagogique : apprend au novice quoi dicter au coach. */
export function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mono" style={{ fontSize: 12, color: 'var(--fg-4)', letterSpacing: '0.03em', lineHeight: 1.5 }}>Vide — <span style={{ color: 'var(--gold-400)' }}>{children}</span></p>;
}

/** Section du scroll = HudCard + PanelHeader + ancre (#id) avec offset header sticky. */
export function Section({ id, code, title, accent = 'gold', right, children }: { id: string; code: string; title: React.ReactNode; accent?: 'gold' | 'tech'; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} style={{ scrollMarginTop: 72 }}>
      <HudCard accent={accent} chamfer="sm" corners={false} style={{ padding: '1rem 1.25rem' }}>
        <PanelHeader code={code} title={title} accent={accent} right={right} />
        {children}
      </HudCard>
    </section>
  );
}
