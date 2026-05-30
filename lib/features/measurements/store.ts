/**
 * CRUD + analytics server-side pour les mensurations corporelles.
 *
 * Path Firestore :
 *   - users/{uid}/measurements/{YYYY-MM-DD} → MeasurementEntry
 *
 * Toutes les fonctions best-effort (log + return fallback en cas d'échec).
 */

import 'server-only';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import {
  deltaBetween,
  mergeUnifiedEntries,
  weeklyToMeasurementFields,
  MEASUREMENT_FIELDS,
  type MeasurementEntry,
  type MeasurementField,
} from './schema';

export async function getMeasurement(
  uid: string,
  dateIso: string,
): Promise<MeasurementEntry | null> {
  try {
    const snap = await adminDb
      .collection('users')
      .doc(uid)
      .collection('measurements')
      .doc(dateIso)
      .get();
    if (!snap.exists) return null;
    return snap.data() as MeasurementEntry;
  } catch (e) {
    console.warn('[measurements/store] getMeasurement failed:', e);
    return null;
  }
}

/**
 * Merge un entry : si un doc existe déjà pour ce jour, les nouveaux champs
 * sont mergés (utile si l'user mesure le tour de taille le matin et le tour
 * de cou le soir).
 */
export async function upsertMeasurement(
  uid: string,
  entry: MeasurementEntry,
): Promise<boolean> {
  try {
    await adminDb
      .collection('users')
      .doc(uid)
      .collection('measurements')
      .doc(entry.date)
      .set({ ...entry, updated_at: FieldValue.serverTimestamp() }, { merge: true });
    return true;
  } catch (e) {
    console.warn('[measurements/store] upsertMeasurement failed:', e);
    return false;
  }
}

/**
 * Liste les N derniers entries (desc par date).
 */
export async function listRecentMeasurements(
  uid: string,
  limit = 60,
): Promise<MeasurementEntry[]> {
  try {
    const snap = await adminDb
      .collection('users')
      .doc(uid)
      .collection('measurements')
      .orderBy('date', 'desc')
      .limit(limit)
      .get();
    return snap.docs.map((d) => d.data() as MeasurementEntry);
  } catch (e) {
    console.warn('[measurements/store] listRecentMeasurements failed:', e);
    return [];
  }
}

/**
 * Série de mensurations UNIFIÉE. Source de vérité = collection `measurements`,
 * COMPLÉTÉE (sans écrasement) par les mensurations du check-in hebdo
 * (checkins_weekly, G/D moyennés) et par la baseline d'onboarding. Réconcilie les
 * deux stores historiques sur UNE seule lecture : le coach, les agents et la page
 * Suivi voient toutes les mensurations quelle que soit la porte d'entrée. Aucune
 * écriture, aucune migration — checkins_weekly conserve ses G/D bruts (zéro perte).
 */
export async function listUnifiedMeasurements(uid: string): Promise<MeasurementEntry[]> {
  const canonical = await listRecentMeasurements(uid, 100);
  let weekly: Array<{ date: string; fields: Partial<Record<MeasurementField, number>> }> = [];
  let baseline: { date: string; fields: Partial<Record<MeasurementField, number>> } | undefined;
  try {
    const userRef = adminDb.collection('users').doc(uid);
    const [userSnap, weeklySnap] = await Promise.all([
      userRef.get(),
      userRef.collection('checkins_weekly').orderBy('created_at', 'desc').limit(104).get(),
    ]);
    weekly = weeklySnap.docs
      .map((d) => {
        const data = d.data();
        const date = typeof data.created_at === 'string' ? data.created_at.slice(0, 10) : '';
        return { date, fields: weeklyToMeasurementFields(data.measurements) };
      })
      .filter((w) => w.date && Object.keys(w.fields).length > 0);
    const u = userSnap.data();
    const bm = u?.baseline?.measurements;
    if (bm) {
      const fields = weeklyToMeasurementFields(bm);
      if (Object.keys(fields).length > 0) {
        const bdate =
          (typeof u?.baseline?.bf_measured_at === 'string' ? u.baseline.bf_measured_at.slice(0, 10) : '') ||
          (userSnap.createTime ? userSnap.createTime.toDate().toISOString().slice(0, 10) : '');
        if (bdate) baseline = { date: bdate, fields };
      }
    }
  } catch (e) {
    console.warn('[measurements/store] listUnifiedMeasurements (weekly/baseline) failed:', e);
  }
  return mergeUnifiedEntries(canonical, weekly, baseline);
}

/**
 * Synthèse pour agents : pour chaque champ, dernière valeur + delta vs 30j et 90j.
 * Renvoie null si pas d'historique.
 */
export interface MeasurementsSnapshot {
  /** Date du dernier entry */
  latest_date: string;
  /** Dernière valeur pour chaque champ */
  latest: Partial<Record<MeasurementField, number>>;
  /** Delta vs il y a 30j (si data dispo) */
  delta_30day: Partial<Record<MeasurementField, { abs_cm: number; pct: number }>>;
  /** Delta vs il y a 90j (si data dispo) */
  delta_90day: Partial<Record<MeasurementField, { abs_cm: number; pct: number }>>;
  /** Nombre total d'entries dans l'historique */
  n_entries: number;
}

export async function getMeasurementsSnapshot(
  uid: string,
): Promise<MeasurementsSnapshot | null> {
  try {
    const entries = await listUnifiedMeasurements(uid);
    if (entries.length === 0) return null;

    // Tri ascendant pour faciliter les recherches d'entries à T-30j / T-90j
    const sorted = [...entries].sort((a, b) => (a.date < b.date ? -1 : 1));
    const latest = sorted[sorted.length - 1];
    const latestT = new Date(latest.date).getTime();

    const findClosestBefore = (daysBack: number): MeasurementEntry | null => {
      const targetT = latestT - daysBack * 24 * 60 * 60 * 1000;
      // Cherche l'entry le plus récent <= target
      let best: MeasurementEntry | null = null;
      for (const e of sorted) {
        const t = new Date(e.date).getTime();
        if (t <= targetT) best = e;
        else break;
      }
      return best;
    };

    const ref30 = findClosestBefore(30);
    const ref90 = findClosestBefore(90);

    const latestValues: Partial<Record<MeasurementField, number>> = {};
    const d30: Partial<Record<MeasurementField, { abs_cm: number; pct: number }>> = {};
    const d90: Partial<Record<MeasurementField, { abs_cm: number; pct: number }>> = {};

    for (const field of MEASUREMENT_FIELDS) {
      const v = latest[field];
      if (typeof v === 'number') latestValues[field] = v;
      if (ref30) {
        const d = deltaBetween(field, ref30, latest);
        if (d) d30[field] = d;
      }
      if (ref90) {
        const d = deltaBetween(field, ref90, latest);
        if (d) d90[field] = d;
      }
    }

    return {
      latest_date: latest.date,
      latest: latestValues,
      delta_30day: d30,
      delta_90day: d90,
      n_entries: entries.length,
    };
  } catch (e) {
    console.warn('[measurements/store] getMeasurementsSnapshot failed:', e);
    return null;
  }
}

/**
 * Extrait les champs mensurations d'un objet profile (utilisé pour migration
 * et pour propager les COACH_SAVE de profile.*_cm vers measurements/).
 */
export function extractMeasurementsFromProfile(
  profile: Record<string, unknown> | undefined,
): Partial<Record<MeasurementField, number>> {
  if (!profile) return {};
  const out: Partial<Record<MeasurementField, number>> = {};
  for (const field of MEASUREMENT_FIELDS) {
    const v = profile[field];
    if (typeof v === 'number') out[field] = v;
  }
  return out;
}
