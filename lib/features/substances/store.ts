/**
 * CRUD + snapshot substances pour agents.
 */

import 'server-only';
import { adminDb } from '@/lib/firebase/admin';
import {
  totalAlcoholUnits,
  totalCaffeineMg,
  totalNicotineUnits,
  type SubstancesLog,
} from './schema';

export async function getSubstancesLog(
  uid: string,
  dateIso: string,
): Promise<SubstancesLog | null> {
  try {
    const snap = await adminDb
      .collection('users')
      .doc(uid)
      .collection('substances_log')
      .doc(dateIso)
      .get();
    if (!snap.exists) return null;
    return snap.data() as SubstancesLog;
  } catch (e) {
    console.warn('[substances/store] getSubstancesLog failed:', e);
    return null;
  }
}

export async function listRecentSubstancesLogs(
  uid: string,
  limit = 7,
): Promise<SubstancesLog[]> {
  try {
    const snap = await adminDb
      .collection('users')
      .doc(uid)
      .collection('substances_log')
      .orderBy('date', 'desc')
      .limit(limit)
      .get();
    return snap.docs.map((d) => d.data() as SubstancesLog);
  } catch (e) {
    console.warn('[substances/store] listRecentSubstancesLogs failed:', e);
    return [];
  }
}

export interface SubstancesSnapshot {
  today_caffeine_mg: number;
  today_alcohol_units: number;
  today_nicotine_units: number;
  avg_7day_caffeine_mg: number;
  avg_7day_alcohol_units: number;
  avg_7day_nicotine_units: number;
  /** Pics caféine récents > 400 mg (count sur 7j) */
  high_caffeine_days_7day: number;
  /** Jours avec >2 unités d'alcool sur 7j */
  drinking_days_7day: number;
  /** Total alcool 7j (signal binge si concentré sur 1-2 jours) */
  total_alcohol_7day: number;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export async function getSubstancesSnapshot(
  uid: string,
): Promise<SubstancesSnapshot | null> {
  try {
    const todayIso = new Date().toISOString().slice(0, 10);
    const recent = await listRecentSubstancesLogs(uid, 7);
    if (recent.length === 0) return null;

    const today = recent.find((d) => d.date === todayIso);
    const todayCaff = today ? totalCaffeineMg(today.entries ?? []) : 0;
    const todayAlc = today ? totalAlcoholUnits(today.entries ?? []) : 0;
    const todayNic = today ? totalNicotineUnits(today.entries ?? []) : 0;

    let sumCaff = 0;
    let sumAlc = 0;
    let sumNic = 0;
    let highCaffDays = 0;
    let drinkingDays = 0;

    for (const d of recent) {
      const caff = totalCaffeineMg(d.entries ?? []);
      const alc = totalAlcoholUnits(d.entries ?? []);
      const nic = totalNicotineUnits(d.entries ?? []);
      sumCaff += caff;
      sumAlc += alc;
      sumNic += nic;
      if (caff > 400) highCaffDays += 1;
      if (alc > 2) drinkingDays += 1;
    }

    return {
      today_caffeine_mg: todayCaff,
      today_alcohol_units: todayAlc,
      today_nicotine_units: todayNic,
      avg_7day_caffeine_mg: Math.round(sumCaff / recent.length),
      avg_7day_alcohol_units: Math.round((sumAlc / recent.length) * 10) / 10,
      avg_7day_nicotine_units: Math.round((sumNic / recent.length) * 10) / 10,
      high_caffeine_days_7day: highCaffDays,
      drinking_days_7day: drinkingDays,
      total_alcohol_7day: Math.round(sumAlc * 10) / 10,
    };
  } catch (e) {
    console.warn('[substances/store] getSubstancesSnapshot failed:', e);
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _MS_REF = SEVEN_DAYS_MS; // unused but kept for future window-based variations
