/**
 * Score "Forme du jour" — synthèse de readiness (0-100) à la Samsung Health
 * (Energy Score). PURE + testable. Pondère les signaux DISPONIBLES uniquement
 * (renormalisation), donc pas de faux score quand il manque des données.
 *
 * Composantes : sommeil (heures + qualité − nuits courtes), HRV (dérive/chronic),
 * hydratation (cibles atteintes), énergie ressentie. Aucun signal → score null.
 */

export interface FormeInput {
  sleep?: { avg_hours_7day: number; avg_quality_7day: number; short_nights_7day: number } | null;
  hrv?: { is_chronic_drift: boolean; baseline_drift_pct: number | null; avg_hrv_7day: number | null } | null;
  hydration?: { days_target_hit_7day: number } | null;
  /** Moyenne énergie ressentie récente (1-10). */
  energyAvg?: number | null;
}

export interface FormeDriver {
  label: string;
  ok: boolean;
}

export interface Forme {
  score: number | null; // 0-100, ou null si aucune donnée
  label: string;
  drivers: FormeDriver[];
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export function computeForme(input: FormeInput): Forme {
  const parts: Array<{ weight: number; value: number; driver: FormeDriver }> = [];

  if (input.sleep) {
    const s = input.sleep;
    let v = 0.6 * clamp01(s.avg_hours_7day / 7.5) + 0.4 * clamp01(s.avg_quality_7day / 10);
    v = clamp01(v - 0.1 * Math.min(3, s.short_nights_7day));
    parts.push({ weight: 0.4, value: v, driver: { label: `Sommeil ${s.avg_hours_7day.toFixed(1)} h`, ok: v >= 0.6 } });
  }
  if (input.hrv && (input.hrv.avg_hrv_7day !== null || input.hrv.is_chronic_drift)) {
    const h = input.hrv;
    let v: number;
    if (h.is_chronic_drift) v = 0.3;
    else if (h.baseline_drift_pct === null) v = 0.7;
    else v = clamp01(1 + h.baseline_drift_pct / 20); // -20% -> 0, 0% -> 1
    parts.push({ weight: 0.25, value: v, driver: { label: h.is_chronic_drift ? 'HRV en fatigue' : 'HRV stable', ok: v >= 0.6 } });
  }
  if (input.hydration) {
    const v = clamp01(input.hydration.days_target_hit_7day / 7);
    parts.push({ weight: 0.15, value: v, driver: { label: `Hydratation ${input.hydration.days_target_hit_7day}/7`, ok: v >= 0.6 } });
  }
  if (typeof input.energyAvg === 'number') {
    const v = clamp01(input.energyAvg / 10);
    parts.push({ weight: 0.2, value: v, driver: { label: `Énergie ${input.energyAvg.toFixed(0)}/10`, ok: v >= 0.6 } });
  }

  if (parts.length === 0) {
    return { score: null, label: 'Données insuffisantes', drivers: [] };
  }

  const totalW = parts.reduce((a, p) => a + p.weight, 0);
  const score = Math.round((parts.reduce((a, p) => a + p.value * p.weight, 0) / totalW) * 100);

  const label =
    score >= 80 ? 'Excellente forme' :
    score >= 60 ? 'Bonne forme' :
    score >= 40 ? 'Forme moyenne' :
    'Récup prioritaire';

  return { score, label, drivers: parts.map((p) => p.driver) };
}
