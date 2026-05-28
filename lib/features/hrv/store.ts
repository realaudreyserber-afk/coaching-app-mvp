/**
 * Phase 15 data-layer — Suivi HRV / stress.
 *
 * Stockage : users/{uid}/hrv_log/{YYYY-MM-DD}
 *
 * HRV (Heart Rate Variability) RMSSD en ms est l'indicateur clé de la
 * récupération du système nerveux autonome. Baseline drift sur 7j = signal
 * fort de fatigue accumulée.
 *
 * Stress score 1-10 = ressenti subjectif (ou import wearable si dispo).
 */

import 'server-only';
import { adminDb } from '@/lib/firebase/admin';

interface HrvLogDoc {
  date: string;
  hrv_rmssd?: number; // ms
  stress_score?: number; // 1-10 subjectif ou wearable
  resting_hr?: number; // bpm
  notes?: string;
}

export interface HrvSnapshot {
  /** HRV moyen 7 derniers jours (ms) */
  avg_hrv_7day: number | null;
  /** Drift vs baseline 28j antérieurs (% — négatif = baisse = fatigue) */
  baseline_drift_pct: number | null;
  /** Stress score moyen 7j (1-10) */
  avg_stress_7day: number | null;
  /** RHR moyen 7j (bpm) */
  avg_rhr_7day: number | null;
  /** Si HRV chronique bas (>5/7 jours < baseline-10%) → signal fatigue */
  is_chronic_drift: boolean;
  logs_count_7day: number;
}

export async function getHrvSnapshot(uid: string): Promise<HrvSnapshot | null> {
  try {
    const snap = await adminDb
      .collection('users')
      .doc(uid)
      .collection('hrv_log')
      .orderBy('date', 'desc')
      .limit(35) // 7j récent + 28j baseline
      .get();
    if (snap.empty) return null;
    const docs = snap.docs.map((d) => d.data() as HrvLogDoc);

    const recent = docs.slice(0, 7);
    const baseline = docs.slice(7, 35);

    const avg = (vals: number[]) =>
      vals.length > 0
        ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10
        : null;

    const recentHrv = recent.map((d) => d.hrv_rmssd).filter((v): v is number => typeof v === 'number');
    const baselineHrv = baseline.map((d) => d.hrv_rmssd).filter((v): v is number => typeof v === 'number');
    const avgRecent = avg(recentHrv);
    const avgBaseline = avg(baselineHrv);
    const drift =
      avgRecent !== null && avgBaseline !== null && avgBaseline > 0
        ? Math.round(((avgRecent - avgBaseline) / avgBaseline) * 100 * 10) / 10
        : null;

    const lowHrvDays = avgBaseline !== null
      ? recent.filter(
          (d) => typeof d.hrv_rmssd === 'number' && d.hrv_rmssd < avgBaseline * 0.9,
        ).length
      : 0;

    return {
      avg_hrv_7day: avgRecent,
      baseline_drift_pct: drift,
      avg_stress_7day: avg(recent.map((d) => d.stress_score).filter((v): v is number => typeof v === 'number')),
      avg_rhr_7day: avg(recent.map((d) => d.resting_hr).filter((v): v is number => typeof v === 'number')),
      is_chronic_drift: lowHrvDays >= 5,
      logs_count_7day: recent.length,
    };
  } catch (e) {
    console.warn('[hrv/store] snapshot failed:', e);
    return null;
  }
}
