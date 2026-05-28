/**
 * Phase 14 data-layer — Suivi sommeil détaillé.
 *
 * Stockage : users/{uid}/sleep_log/{YYYY-MM-DD}
 *
 * Note : wearable_sync ne stocke actuellement que steps (audit 2026-05-28).
 * Quand un wearable enverra ces données, on pourra agréger automatiquement.
 * Pour l'instant : saisie manuelle simple.
 */

import 'server-only';
import { adminDb } from '@/lib/firebase/admin';

interface SleepLogDoc {
  date: string;
  sleep_hours?: number;
  deep_pct?: number;
  rem_pct?: number;
  awakenings?: number;
  quality?: number; // 1-10
  bedtime?: string; // HH:MM
  notes?: string;
}

export interface SleepSnapshot {
  /** Moyenne heures de sommeil sur 7 derniers jours */
  avg_hours_7day: number;
  /** Qualité moyenne sur 7j (1-10) */
  avg_quality_7day: number;
  /** Nombre de jours < 6h sommeil sur 7 derniers */
  short_nights_7day: number;
  /** Sommeil hier (si dispo) */
  yesterday: { hours: number; quality: number } | null;
  /** Nombre de logs sur 7 derniers jours */
  logs_count_7day: number;
}

export async function getSleepSnapshot(uid: string): Promise<SleepSnapshot | null> {
  try {
    const snap = await adminDb
      .collection('users')
      .doc(uid)
      .collection('sleep_log')
      .orderBy('date', 'desc')
      .limit(7)
      .get();
    if (snap.empty) return null;
    const docs = snap.docs.map((d) => d.data() as SleepLogDoc);

    const validHours = docs.map((d) => d.sleep_hours).filter((h): h is number => typeof h === 'number');
    const validQuality = docs.map((d) => d.quality).filter((q): q is number => typeof q === 'number');
    const avgHours = validHours.length > 0
      ? Math.round((validHours.reduce((s, v) => s + v, 0) / validHours.length) * 10) / 10
      : 0;
    const avgQuality = validQuality.length > 0
      ? Math.round((validQuality.reduce((s, v) => s + v, 0) / validQuality.length) * 10) / 10
      : 0;
    const shortNights = validHours.filter((h) => h < 6).length;

    const yesterdayIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const yesterdayEntry = docs.find((d) => d.date === yesterdayIso);
    const yesterday = yesterdayEntry?.sleep_hours
      ? { hours: yesterdayEntry.sleep_hours, quality: yesterdayEntry.quality ?? 5 }
      : null;

    return {
      avg_hours_7day: avgHours,
      avg_quality_7day: avgQuality,
      short_nights_7day: shortNights,
      yesterday,
      logs_count_7day: docs.length,
    };
  } catch (e) {
    console.warn('[sleep/store] snapshot failed:', e);
    return null;
  }
}
