/**
 * CRUD + snapshot hydration pour les agents.
 */

import 'server-only';
import { adminDb } from '@/lib/firebase/admin';
import { effectiveHydrationMl, type HydrationLog } from './schema';

export async function getHydrationLog(
  uid: string,
  dateIso: string,
): Promise<HydrationLog | null> {
  try {
    const snap = await adminDb
      .collection('users')
      .doc(uid)
      .collection('hydration_log')
      .doc(dateIso)
      .get();
    if (!snap.exists) return null;
    return snap.data() as HydrationLog;
  } catch (e) {
    console.warn('[hydration/store] getHydrationLog failed:', e);
    return null;
  }
}

export async function listRecentHydrationLogs(
  uid: string,
  limit = 7,
): Promise<HydrationLog[]> {
  try {
    const snap = await adminDb
      .collection('users')
      .doc(uid)
      .collection('hydration_log')
      .orderBy('date', 'desc')
      .limit(limit)
      .get();
    return snap.docs.map((d) => d.data() as HydrationLog);
  } catch (e) {
    console.warn('[hydration/store] listRecentHydrationLogs failed:', e);
    return [];
  }
}

export interface HydrationSnapshot {
  /** Total effectif aujourd'hui (ml, calculé avec coefficients par type) */
  today_effective_ml: number;
  /** Total raw aujourd'hui (somme brute) */
  today_raw_ml: number;
  /** Target aujourd'hui (ml) */
  today_target_ml: number;
  /** Moyenne effective sur les 7 derniers jours (ml) */
  avg_7day_ml: number;
  /** Nombre de jours dans la période où la cible a été atteinte (sur 7 derniers jours) */
  days_target_hit_7day: number;
  /** Nombre de prises aujourd'hui */
  today_entries_count: number;
}

export async function getHydrationSnapshot(uid: string): Promise<HydrationSnapshot | null> {
  try {
    const todayIso = new Date().toISOString().slice(0, 10);
    const recent = await listRecentHydrationLogs(uid, 7);
    if (recent.length === 0) return null;

    const today = recent.find((d) => d.date === todayIso);
    const todayEffective = today ? effectiveHydrationMl(today.entries ?? []) : 0;
    const todayRaw = today ? (today.entries ?? []).reduce((s, e) => s + e.ml, 0) : 0;
    const todayTarget = today?.target_ml ?? 2500;
    const todayCount = today?.entries?.length ?? 0;

    let totalEffective = 0;
    let daysHit = 0;
    for (const d of recent) {
      const eff = effectiveHydrationMl(d.entries ?? []);
      totalEffective += eff;
      if (eff >= (d.target_ml ?? 2500)) daysHit += 1;
    }
    const avg7 = Math.round(totalEffective / recent.length);

    return {
      today_effective_ml: todayEffective,
      today_raw_ml: todayRaw,
      today_target_ml: todayTarget,
      avg_7day_ml: avg7,
      days_target_hit_7day: daysHit,
      today_entries_count: todayCount,
    };
  } catch (e) {
    console.warn('[hydration/store] getHydrationSnapshot failed:', e);
    return null;
  }
}
