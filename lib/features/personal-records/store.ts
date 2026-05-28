/**
 * CRUD + auto-detection PRs.
 *
 * Path Firestore : users/{uid}/prs/{exerciseId}
 *
 * Entry-point principal : detectPrsFromSession() — appelé à la fin d'une
 * workout_session pour scanner les exos et update les PR si nouveau record.
 */

import 'server-only';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import {
  epley1RM,
  exerciseNameToId,
  shouldTrackPr,
  type Pr,
  type PrEntry,
} from './schema';

export async function getPr(uid: string, exerciseId: string): Promise<Pr | null> {
  try {
    const snap = await adminDb
      .collection('users')
      .doc(uid)
      .collection('prs')
      .doc(exerciseId)
      .get();
    if (!snap.exists) return null;
    return snap.data() as Pr;
  } catch (e) {
    console.warn('[prs/store] getPr failed:', e);
    return null;
  }
}

export async function listAllPrs(uid: string, limit = 50): Promise<Pr[]> {
  try {
    const snap = await adminDb
      .collection('users')
      .doc(uid)
      .collection('prs')
      .orderBy('last_pr_date', 'desc')
      .limit(limit)
      .get();
    return snap.docs.map((d) => d.data() as Pr);
  } catch (e) {
    console.warn('[prs/store] listAllPrs failed:', e);
    return [];
  }
}

/**
 * Snapshot compact pour les agents : top exos avec current_1rm + progression
 * récente (delta vs PR d'il y a 90 jours).
 */
export interface PrsSnapshot {
  /** Top exos par récence de PR */
  top_exercises: Array<{
    exercise_name: string;
    current_1rm: number;
    last_pr_date: string | undefined;
    n_prs_total: number;
    /** Variation 1RM vs il y a 90j (kg) */
    delta_90day_kg: number | null;
    /** Variation 1RM vs il y a 90j (%) */
    delta_90day_pct: number | null;
  }>;
  n_exercises_tracked: number;
}

export async function getPrsSnapshot(uid: string): Promise<PrsSnapshot | null> {
  try {
    const allPrs = await listAllPrs(uid, 30);
    if (allPrs.length === 0) return null;

    const cutoff90 = Date.now() - 90 * 24 * 60 * 60 * 1000;

    const topExercises = allPrs.slice(0, 8).map((pr) => {
      // Trouver le PR le plus proche de t-90j
      let pr90: number | null = null;
      const sorted = [...pr.prs].sort((a, b) => (a.date < b.date ? -1 : 1));
      for (const e of sorted) {
        if (new Date(e.date).getTime() <= cutoff90) {
          pr90 = e.estimated_1rm;
        } else {
          break;
        }
      }
      const deltaKg = pr90 !== null ? Math.round((pr.current_1rm - pr90) * 10) / 10 : null;
      const deltaPct =
        pr90 !== null && pr90 > 0
          ? Math.round(((pr.current_1rm - pr90) / pr90) * 100 * 10) / 10
          : null;

      return {
        exercise_name: pr.exercise_name,
        current_1rm: pr.current_1rm,
        last_pr_date: pr.last_pr_date,
        n_prs_total: pr.prs.length,
        delta_90day_kg: deltaKg,
        delta_90day_pct: deltaPct,
      };
    });

    return {
      top_exercises: topExercises,
      n_exercises_tracked: allPrs.length,
    };
  } catch (e) {
    console.warn('[prs/store] getPrsSnapshot failed:', e);
    return null;
  }
}

/**
 * Append un PR à un exo (créé le doc si inexistant). Update current_1rm si
 * l'estimated_1rm de ce nouvel entry > current.
 */
export async function appendPr(
  uid: string,
  exerciseName: string,
  entry: PrEntry,
): Promise<boolean> {
  try {
    const exerciseId = exerciseNameToId(exerciseName);
    const ref = adminDb.collection('users').doc(uid).collection('prs').doc(exerciseId);
    const snap = await ref.get();
    const existing = snap.exists ? (snap.data() as Pr) : null;
    const newCurrent = Math.max(existing?.current_1rm ?? 0, entry.estimated_1rm);
    const newDoc: Pr = {
      exercise_id: exerciseId,
      exercise_name: exerciseName,
      prs: [...(existing?.prs ?? []), entry].sort((a, b) => (a.date < b.date ? -1 : 1)),
      current_1rm: newCurrent,
      last_pr_date: entry.date,
    };
    await ref.set({ ...newDoc, updated_at: FieldValue.serverTimestamp() }, { merge: true });
    return true;
  } catch (e) {
    console.warn('[prs/store] appendPr failed:', e);
    return false;
  }
}

/**
 * Type minimal pour parser un set d'une workout_session.
 * Compatible avec différents schemas existants (defensive parsing).
 */
interface SessionExerciseSet {
  weight?: number | string;
  weight_kg?: number | string;
  reps?: number | string;
  // tolérance à divers field names
}

interface SessionExercise {
  name?: string;
  exercise_name?: string;
  name_fr?: string;
  sets?: SessionExerciseSet[];
}

interface WorkoutSessionLite {
  date?: string;
  exercises?: SessionExercise[];
}

/**
 * Scan une workout_session terminée. Pour chaque exo trackable (cf.
 * PR_TRACKED_EXERCISES_PATTERNS), trouve le meilleur set (max estimated_1rm),
 * compare au PR existant, et append si nouveau record.
 *
 * Best-effort : si parsing échoue sur un exo, on skip mais on continue.
 * Retourne le nombre de PRs détectés (pour logging).
 */
export async function detectPrsFromSession(
  uid: string,
  sessionId: string,
  session: WorkoutSessionLite,
): Promise<number> {
  if (!session.exercises || !Array.isArray(session.exercises)) return 0;
  const sessionDate =
    typeof session.date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(session.date)
      ? session.date.slice(0, 10)
      : new Date().toISOString().slice(0, 10);

  let detected = 0;
  for (const exo of session.exercises) {
    const name = exo.name ?? exo.exercise_name ?? exo.name_fr;
    if (!name || typeof name !== 'string') continue;
    if (!shouldTrackPr(name)) continue;
    if (!Array.isArray(exo.sets) || exo.sets.length === 0) continue;

    // Trouve le meilleur set (max estimated_1rm Epley)
    let bestSet: { weight: number; reps: number; e1rm: number } | null = null;
    for (const set of exo.sets) {
      const weight = typeof set.weight === 'number' ? set.weight
        : typeof set.weight_kg === 'number' ? set.weight_kg
        : typeof set.weight === 'string' ? parseFloat(set.weight)
        : typeof set.weight_kg === 'string' ? parseFloat(set.weight_kg)
        : NaN;
      const reps = typeof set.reps === 'number' ? set.reps
        : typeof set.reps === 'string' ? parseFloat(set.reps)
        : NaN;
      if (Number.isNaN(weight) || Number.isNaN(reps) || weight <= 0 || reps < 1) continue;
      const e1rm = epley1RM(weight, reps);
      if (!bestSet || e1rm > bestSet.e1rm) {
        bestSet = { weight, reps, e1rm };
      }
    }
    if (!bestSet) continue;

    // Compare au PR existant
    try {
      const exerciseId = exerciseNameToId(name);
      const existing = await getPr(uid, exerciseId);
      const currentPR = existing?.current_1rm ?? 0;
      // Ne PR que si strict gain (>0.5 kg de 1RM estimé) — sinon noise
      if (bestSet.e1rm > currentPR + 0.5) {
        await appendPr(uid, name, {
          date: sessionDate,
          weight_kg: bestSet.weight,
          reps: bestSet.reps,
          estimated_1rm: bestSet.e1rm,
          source: 'auto_from_session',
          session_id: sessionId,
        });
        detected++;
      }
    } catch (e) {
      console.warn(`[prs/store] PR detection failed for exo "${name}":`, e);
    }
  }
  return detected;
}
