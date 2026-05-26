/**
 * Coach State store — server-side getters / mutators for users/{uid}/coach_state/main.
 *
 * Wave 6B. Used by:
 *   - /api/ai/coach (reads state, marks last_intervention_at)
 *   - /api/coach/welcome (sets welcome_sent = true after first proactive msg)
 *   - /api/coach/plan-debrief (sets plan_debrief_sent = true after first plan commentary)
 *   - Any future proactive intervention path
 */

import 'server-only';
import { adminDb } from '@/lib/firebase/admin';
import {
  type CoachState,
  type CoachPendingFollowup,
  DEFAULT_COACH_STATE,
  MAX_TOPICS_DISCUSSED,
} from './schema';

function ref(uid: string) {
  return adminDb.collection('users').doc(uid).collection('coach_state').doc('main');
}

/**
 * Load or initialize the coach state for this user. Returns a non-null object.
 *
 * Wave 6 review M5 fix : distinguish "doc absent" (safe to return defaults +
 * caller will create on write) from "read failed" (network outage etc) —
 * in the failure case we rethrow so the caller doesn't blindly overwrite
 * existing data with defaults.
 */
export async function loadCoachState(uid: string): Promise<CoachState> {
  const snap = await ref(uid).get(); // let exception propagate
  if (snap.exists) {
    const data = snap.data() as Partial<CoachState>;
    return {
      ...DEFAULT_COACH_STATE,
      created_at: data.created_at ?? new Date().toISOString(),
      updated_at: data.updated_at ?? new Date().toISOString(),
      ...data,
    } as CoachState;
  }
  const now = new Date().toISOString();
  return {
    ...DEFAULT_COACH_STATE,
    created_at: now,
    updated_at: now,
  };
}

/**
 * Merge-patch the coach state. Caller passes only the fields it wants to change.
 * `updated_at` is bumped automatically.
 */
export async function patchCoachState(
  uid: string,
  patch: Partial<CoachState>,
): Promise<void> {
  try {
    const now = new Date().toISOString();
    await ref(uid).set(
      {
        ...patch,
        updated_at: now,
        ...(patch.created_at ? {} : {}), // never touch created_at if already set
      },
      { merge: true },
    );
  } catch (e) {
    console.warn('[coach-state] patch failed:', e);
  }
}

/**
 * Convenience: stamp the coach as having intervened just now.
 *
 * Wave 6 review C3 fix : was previously a non-transactional read-modify-write
 * that lost concurrent topic additions. Now uses runTransaction with the
 * coach_state doc so concurrent calls serialize and topic additions merge.
 */
export async function markCoachIntervention(
  uid: string,
  opts: { markUnread?: boolean; topic?: string } = {},
): Promise<void> {
  try {
    await adminDb.runTransaction(async (tx) => {
      const docRef = ref(uid);
      const snap = await tx.get(docRef);
      const current = snap.exists ? (snap.data() as Partial<CoachState>) : null;
      const existingTopics = current?.topics_discussed ?? [];
      const newTopics = opts.topic
        ? Array.from(new Set([...existingTopics, opts.topic])).slice(-MAX_TOPICS_DISCUSSED)
        : existingTopics;
      const now = new Date().toISOString();
      tx.set(
        docRef,
        {
          ...(snap.exists ? {} : { ...DEFAULT_COACH_STATE, created_at: now }),
          last_intervention_at: now,
          has_unread_intervention: opts.markUnread
            ? true
            : current?.has_unread_intervention ?? false,
          topics_discussed: newTopics,
          updated_at: now,
        },
        { merge: true },
      );
    });
  } catch (e) {
    console.warn('[coach-state] markCoachIntervention tx failed:', e);
  }
}

/** Mark all proactive interventions as read (called when user opens /coach). */
export async function markInterventionsRead(uid: string): Promise<void> {
  await patchCoachState(uid, { has_unread_intervention: false });
}

/**
 * Add a pending followup.
 *
 * Wave 6 review C3 fix : transactional read-modify-write so concurrent calls
 * don't clobber each other.
 */
export async function addPendingFollowup(
  uid: string,
  fu: Omit<CoachPendingFollowup, 'id' | 'created_at'>,
): Promise<void> {
  try {
    await adminDb.runTransaction(async (tx) => {
      const docRef = ref(uid);
      const snap = await tx.get(docRef);
      const current = snap.exists ? (snap.data() as Partial<CoachState>) : null;
      const id = Math.random().toString(36).slice(2, 12);
      const now = new Date().toISOString();
      const newFu: CoachPendingFollowup = { ...fu, id, created_at: now };
      const merged = [...(current?.pending_followups ?? []), newFu].slice(-20);
      tx.set(
        docRef,
        {
          ...(snap.exists ? {} : { ...DEFAULT_COACH_STATE, created_at: now }),
          pending_followups: merged,
          updated_at: now,
        },
        { merge: true },
      );
    });
  } catch (e) {
    console.warn('[coach-state] addPendingFollowup tx failed:', e);
  }
}
