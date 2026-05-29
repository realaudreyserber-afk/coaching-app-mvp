/**
 * computeWeightTrend — tendance de poids calculée côté serveur sur une fenêtre
 * étendue (check-ins quotidiens).
 *
 * Audit 2026-05-29 : l'AnalyticsCoach ne chargeait que 7 jours de check-ins,
 * rendant impossibles les diagnostics qui sont pourtant SON rôle (plateau
 * > 3 semaines, recalibrage TDEE sur N semaines, rythme observé vs cible).
 * On agrège ici sur toute la fenêtre fournie pour exposer kg/semaine + un
 * indicateur de plateau, au lieu de laisser le LLM agréger sur 7 points.
 *
 * Fonction PURE (testable, pas d'I/O).
 */

export interface DatedWeight {
  date?: string | null;
  weight?: number | null;
}

export interface WeightTrend {
  /** Nombre de points de poids valides (finite) dans la fenêtre */
  n_points: number;
  /** Amplitude couverte en jours (premier → dernier point) */
  span_days: number;
  /** Tendance linéaire premier→dernier, en kg/semaine (null si < 7 jours) */
  kg_per_week: number | null;
  /** Plateau heuristique : ≥ 21 jours d'historique ET |kg/sem| < 0.2 */
  plateau: boolean;
  /** Durée du plateau en semaines (null si pas de plateau) */
  plateau_weeks: number | null;
  /** Moyenne de poids par semaine glissante depuis le 1er point (S+0, S+1, …) */
  weekly_avg: Array<{ week: string; avg_kg: number; n: number }>;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const PLATEAU_MIN_DAYS = 21;
const PLATEAU_KG_PER_WEEK = 0.2; // |variation| en dessous = stagnation

function round(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

export function computeWeightTrend(points: DatedWeight[]): WeightTrend {
  const valid = (points ?? [])
    .filter(
      (p): p is { date: string; weight: number } =>
        !!p &&
        typeof p.date === 'string' &&
        p.date.length > 0 &&
        typeof p.weight === 'number' &&
        Number.isFinite(p.weight),
    )
    .map((p) => ({ ms: Date.parse(p.date), weight: p.weight }))
    .filter((p) => Number.isFinite(p.ms))
    .sort((a, b) => a.ms - b.ms);

  if (valid.length === 0) {
    return {
      n_points: 0,
      span_days: 0,
      kg_per_week: null,
      plateau: false,
      plateau_weeks: null,
      weekly_avg: [],
    };
  }

  const first = valid[0];
  const last = valid[valid.length - 1];
  const spanDays = Math.round((last.ms - first.ms) / DAY_MS);
  const kgPerWeek =
    spanDays >= 7 ? round(((last.weight - first.weight) / spanDays) * 7, 3) : null;

  // Moyennes hebdomadaires (buckets de 7 jours depuis le 1er point)
  const buckets = new Map<number, { sum: number; n: number }>();
  for (const p of valid) {
    const wk = Math.floor((p.ms - first.ms) / WEEK_MS);
    const cur = buckets.get(wk) ?? { sum: 0, n: 0 };
    cur.sum += p.weight;
    cur.n += 1;
    buckets.set(wk, cur);
  }
  const weekly_avg = [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([wk, v]) => ({ week: `S+${wk}`, avg_kg: round(v.sum / v.n, 2), n: v.n }));

  const plateau =
    spanDays >= PLATEAU_MIN_DAYS &&
    kgPerWeek !== null &&
    Math.abs(kgPerWeek) < PLATEAU_KG_PER_WEEK;

  return {
    n_points: valid.length,
    span_days: spanDays,
    kg_per_week: kgPerWeek,
    plateau,
    plateau_weeks: plateau ? Math.round(spanDays / 7) : null,
    weekly_avg,
  };
}
