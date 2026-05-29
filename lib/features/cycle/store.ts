/**
 * CRUD server-side pour le suivi cycle menstruel.
 *
 * Path Firestore :
 *   - users/{uid}/cycles/{YYYY-MM-DD} → CycleEntry par jour
 *   - users/{uid}/cycle_settings/main → CycleSettings
 *
 * Toutes les fonctions sont best-effort : en cas d'échec Firestore, log + return
 * fallback (null / [] / undefined) plutôt que throw. Le coach n'est pas bloqué
 * par un fetch cycle.
 */

import 'server-only';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import {
  computeCyclePhase,
  type CycleEntry,
  type CyclePhase,
  type CycleSettings,
} from './schema';

const SETTINGS_DOC_ID = 'main';

/**
 * Lit un entry cycle pour un jour précis.
 */
export async function getCycleEntry(
  uid: string,
  dateIso: string,
): Promise<CycleEntry | null> {
  try {
    const snap = await adminDb
      .collection('users')
      .doc(uid)
      .collection('cycles')
      .doc(dateIso)
      .get();
    if (!snap.exists) return null;
    return snap.data() as CycleEntry;
  } catch (e) {
    console.warn('[cycle/store] getCycleEntry failed:', e);
    return null;
  }
}

/**
 * Écrit / merge un entry cycle.
 */
export async function setCycleEntry(uid: string, entry: CycleEntry): Promise<boolean> {
  try {
    await adminDb
      .collection('users')
      .doc(uid)
      .collection('cycles')
      .doc(entry.date)
      .set({ ...entry, updated_at: FieldValue.serverTimestamp() }, { merge: true });
    return true;
  } catch (e) {
    console.warn('[cycle/store] setCycleEntry failed:', e);
    return false;
  }
}

/**
 * Lit les N derniers entries cycle, ordre desc par date.
 */
export async function listRecentCycleEntries(
  uid: string,
  limit = 90,
): Promise<CycleEntry[]> {
  try {
    const snap = await adminDb
      .collection('users')
      .doc(uid)
      .collection('cycles')
      .orderBy('date', 'desc')
      .limit(limit)
      .get();
    return snap.docs.map((d) => d.data() as CycleEntry);
  } catch (e) {
    console.warn('[cycle/store] listRecentCycleEntries failed:', e);
    return [];
  }
}

/**
 * Lit les cycle_settings (config user). Renvoie defaults si pas de doc.
 */
export async function getCycleSettings(uid: string): Promise<CycleSettings | null> {
  try {
    const snap = await adminDb
      .collection('users')
      .doc(uid)
      .collection('cycle_settings')
      .doc(SETTINGS_DOC_ID)
      .get();
    if (!snap.exists) return null;
    return snap.data() as CycleSettings;
  } catch (e) {
    console.warn('[cycle/store] getCycleSettings failed:', e);
    return null;
  }
}

/**
 * Écrit / merge les cycle_settings.
 */
export async function setCycleSettings(
  uid: string,
  settings: Partial<CycleSettings>,
): Promise<boolean> {
  try {
    await adminDb
      .collection('users')
      .doc(uid)
      .collection('cycle_settings')
      .doc(SETTINGS_DOC_ID)
      .set({ ...settings, updated_at: FieldValue.serverTimestamp() }, { merge: true });
    return true;
  } catch (e) {
    console.warn('[cycle/store] setCycleSettings failed:', e);
    return false;
  }
}

/**
 * Trouve la date du début de la dernière période (flow_intensity > 0).
 * Retourne null si rien trouvé dans les 60 derniers jours.
 */
export async function findLastPeriodStart(uid: string): Promise<string | null> {
  try {
    const entries = await listRecentCycleEntries(uid, 60);
    // Chercher le premier jour de la séquence "menstrual" la plus récente.
    // On parcourt en desc : on cherche le premier jour avec flow > 0, puis on
    // remonte tant que les jours juste avant ont aussi flow > 0 (séquence).
    const sorted = entries.sort((a, b) => (a.date < b.date ? -1 : 1));
    let lastSeqStart: string | null = null;
    let inSeq = false;
    for (const e of sorted) {
      if (e.flow_intensity > 0) {
        if (!inSeq) {
          lastSeqStart = e.date;
          inSeq = true;
        }
      } else {
        inSeq = false;
      }
    }
    return lastSeqStart;
  } catch (e) {
    console.warn('[cycle/store] findLastPeriodStart failed:', e);
    return null;
  }
}

/**
 * Synthèse cycle pour les agents : phase actuelle + jour-dans-cycle + symptômes
 * récents. Retourne null si pas de tracking ou pas assez de data pour inférer.
 *
 * Cette fonction est ce que les sous-agents appellent dans leur fetchContext.
 */
export interface CycleSnapshot {
  /** Phase théorique aujourd'hui (calculée depuis dernière période + settings) */
  current_phase: CyclePhase | null;
  /** Jour dans le cycle (0 = J1 des règles, etc.). null si inconnu */
  day_in_cycle: number | null;
  /** Settings user (longueur moyenne, régularité, etc.) */
  settings: CycleSettings | null;
  /** Symptômes loggés sur les 7 derniers jours (agrégés) */
  symptoms_last_7day: Record<string, number>; // symptom → count
  /** Date du début de la dernière période (YYYY-MM-DD) ou null */
  last_period_start: string | null;
  /** Sous contraception hormonale (auquel cas phase est moins parlante) */
  on_hormonal_contraception: boolean;
  /** Jours depuis le début de la dernière période (null si inconnu) */
  days_since_last_period: number | null;
  /**
   * Aménorrhée suspectée : > 3 cycles sans règles ET pas sous contraception
   * hormonale. Signal santé sérieux (REDS) — à DÉLÉGUER à safety, jamais conclure.
   * Avant (audit 2026-05-29), ce signal reposait sur une inférence côté LLM.
   */
  amenorrhea_suspected: boolean;
}

export async function getCycleSnapshot(uid: string): Promise<CycleSnapshot | null> {
  try {
    const [settings, lastPeriodStart, recentEntries] = await Promise.all([
      getCycleSettings(uid),
      findLastPeriodStart(uid),
      listRecentCycleEntries(uid, 7),
    ]);

    // Pas de tracking du tout — pas de snapshot utile
    if (!settings && !lastPeriodStart && recentEntries.length === 0) return null;

    const todayIso = new Date().toISOString().slice(0, 10);
    const avgCycle = settings?.avg_cycle_length_days ?? 28;
    const avgPeriod = settings?.avg_period_length_days ?? 5;

    let current_phase: CyclePhase | null = null;
    let day_in_cycle: number | null = null;
    let days_since_last_period: number | null = null;
    if (lastPeriodStart) {
      current_phase = computeCyclePhase(todayIso, lastPeriodStart, avgCycle, avgPeriod);
      const dayDiff = Math.floor(
        (new Date(todayIso).getTime() - new Date(lastPeriodStart).getTime()) /
          (24 * 60 * 60 * 1000),
      );
      day_in_cycle = dayDiff % avgCycle;
      days_since_last_period = dayDiff;
    }

    // Override avec entry du jour si explicitement marqué (non predicted)
    const todayEntry = recentEntries.find((e) => e.date === todayIso);
    if (todayEntry?.phase && !todayEntry.predicted) {
      current_phase = todayEntry.phase;
    }

    const symptoms_last_7day: Record<string, number> = {};
    recentEntries.forEach((e) => {
      (e.symptoms ?? []).forEach((s) => {
        symptoms_last_7day[s] = (symptoms_last_7day[s] ?? 0) + 1;
      });
    });

    return {
      current_phase,
      day_in_cycle,
      settings,
      symptoms_last_7day,
      last_period_start: lastPeriodStart,
      on_hormonal_contraception: settings?.hormonal_contraception?.active ?? false,
      days_since_last_period,
      amenorrhea_suspected:
        !(settings?.hormonal_contraception?.active ?? false) &&
        days_since_last_period !== null &&
        days_since_last_period > avgCycle * 3,
    };
  } catch (e) {
    console.warn('[cycle/store] getCycleSnapshot failed:', e);
    return null;
  }
}
