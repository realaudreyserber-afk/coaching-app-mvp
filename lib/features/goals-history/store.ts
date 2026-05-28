/**
 * Archive + lecture historique des objectifs.
 */

import 'server-only';
import { adminDb } from '@/lib/firebase/admin';
import type { GoalsHistoryEntry, GoalsSnapshot } from './schema';

const GOALS_KEYS = ['primary_goal', 'target_weight', 'target_bf_pct', 'type', 'deadline'] as const;

/**
 * Snapshot les goals actuels (juste avant un patch) dans goals_history/.
 * Appelé depuis /api/profile/update-fields quand un patch touche goals.*.
 *
 * Fait rien si pas de goals existants OU si le patch ne change rien.
 */
export async function archiveGoalsBeforeChange(
  uid: string,
  pendingPatch: Record<string, unknown>,
): Promise<void> {
  // Filter pending updates that target goals.*
  const goalUpdates: Record<string, unknown> = {};
  for (const k of GOALS_KEYS) {
    const path = `goals.${k}`;
    if (path in pendingPatch) goalUpdates[k] = pendingPatch[path];
  }
  if (Object.keys(goalUpdates).length === 0) return;

  try {
    const userSnap = await adminDb.collection('users').doc(uid).get();
    const currentGoals = (userSnap.data()?.goals ?? {}) as Record<string, unknown>;

    // Skip if there are no current goals to archive
    if (Object.keys(currentGoals).length === 0) return;

    // Skip if the patch doesn't actually CHANGE anything
    let changed = false;
    for (const [k, v] of Object.entries(goalUpdates)) {
      if (currentGoals[k] !== v) {
        changed = true;
        break;
      }
    }
    if (!changed) return;

    const snapshot: GoalsSnapshot = {};
    for (const k of GOALS_KEYS) {
      const v = currentGoals[k];
      if (v !== undefined && v !== null) {
        (snapshot as Record<string, unknown>)[k] = v;
      }
    }

    const archivedAt = new Date().toISOString();
    const entry: GoalsHistoryEntry = {
      archived_at: archivedAt,
      previous_goals: snapshot,
    };

    await adminDb
      .collection('users')
      .doc(uid)
      .collection('goals_history')
      .doc(archivedAt)
      .set(entry);
  } catch (e) {
    console.warn('[goals-history/store] archiveGoalsBeforeChange failed:', e);
    // best-effort — ne pas bloquer l'update
  }
}

export interface GoalsHistorySnapshot {
  /** Compteur total de changements d'objectif */
  total_changes: number;
  /** Date du premier changement enregistré */
  first_change_at: string | null;
  /** Date du dernier changement */
  last_change_at: string | null;
  /** Goals au moment du dernier changement (= goals précédents si user a changé récemment) */
  last_previous_goals: GoalsSnapshot | null;
  /** Si > 3 changements en 90j → instabilité d'objectif à signaler */
  is_unstable: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export async function getGoalsHistorySnapshot(
  uid: string,
): Promise<GoalsHistorySnapshot | null> {
  try {
    const snap = await adminDb
      .collection('users')
      .doc(uid)
      .collection('goals_history')
      .orderBy('archived_at', 'desc')
      .limit(20)
      .get();
    if (snap.empty) return null;
    const entries = snap.docs.map((d) => d.data() as GoalsHistoryEntry);

    const ninetyDaysAgoT = Date.now() - 90 * DAY_MS;
    const recentChanges = entries.filter(
      (e) => new Date(e.archived_at).getTime() > ninetyDaysAgoT,
    );

    return {
      total_changes: entries.length,
      first_change_at: entries[entries.length - 1]?.archived_at ?? null,
      last_change_at: entries[0]?.archived_at ?? null,
      last_previous_goals: entries[0]?.previous_goals ?? null,
      is_unstable: recentChanges.length >= 3,
    };
  } catch (e) {
    console.warn('[goals-history/store] snapshot failed:', e);
    return null;
  }
}
