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
 * Load or initialize the coach state for this user. Always returns a non-null
 * object. If the doc doesn't exist, returns the default (without persisting —
 * persistence happens on first write).
 */
export async function loadCoachState(uid: string): Promise<CoachState> {
  try {
    const snap = await ref(uid).get();
    if (snap.exists) {
      const data = snap.data() as Partial<CoachState>;
      return {
        ...DEFAULT_COACH_STATE,
        created_at: data.created_at ?? new Date().toISOString(),
        updated_at: data.updated_at ?? new Date().toISOString(),
        ...data,
      } as CoachState;
    }
  } catch (e) {
    console.warn('[coach-state] load failed:', e);
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
 * If `markUnread` is true, also flag has_unread_intervention so /dashboard can
 * surface a badge.
 */
export async function markCoachIntervention(
  uid: string,
  opts: { markUnread?: boolean; topic?: string } = {},
): Promise<void> {
  const current = await loadCoachState(uid);
  const newTopics = opts.topic
    ? Array.from(new Set([...current.topics_discussed, opts.topic])).slice(-MAX_TOPICS_DISCUSSED)
    : current.topics_discussed;
  await patchCoachState(uid, {
    last_intervention_at: new Date().toISOString(),
    has_unread_intervention: opts.markUnread ? true : current.has_unread_intervention,
    topics_discussed: newTopics,
  });
}

/** Mark all proactive interventions as read (called when user opens /coach). */
export async function markInterventionsRead(uid: string): Promise<void> {
  await patchCoachState(uid, { has_unread_intervention: false });
}

/** Add a pending followup. */
export async function addPendingFollowup(
  uid: string,
  fu: Omit<CoachPendingFollowup, 'id' | 'created_at'>,
): Promise<void> {
  const current = await loadCoachState(uid);
  const id = Math.random().toString(36).slice(2, 12);
  const now = new Date().toISOString();
  const newFu: CoachPendingFollowup = { ...fu, id, created_at: now };
  await patchCoachState(uid, {
    pending_followups: [...current.pending_followups, newFu].slice(-20),
  });
}
