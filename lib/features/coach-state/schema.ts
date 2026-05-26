/**
 * Coach State — persistent memory the coach keeps across sessions.
 *
 * Stored at `users/{uid}/coach_state/main` (singleton).
 *
 * Wave 6B intent: the coach should remember
 *  - last time it intervened (proactively or via chat)
 *  - topics it has already covered (so it doesn't re-explain VO2max every week)
 *  - pending followups (things it promised to revisit)
 *  - the user's preferred response style (learned via heuristics or asked)
 *  - whether the user has an unread proactive intervention
 *
 * All fields snake_case per ADR-006.
 */

export type CoachResponseStyle = 'short' | 'verbose' | 'data_driven' | 'mixed';

export interface CoachPendingFollowup {
  id: string; // ulid-ish
  topic: string; // e.g. "vérifier sommeil semaine 3"
  due_at: string; // ISO date when to bring it up
  created_at: string;
  done?: boolean;
}

export interface CoachState {
  /** Last time the coach said anything (proactive or reactive) */
  last_intervention_at?: string;
  /** Has a proactive intervention waiting to be read on /dashboard or /coach? */
  has_unread_intervention: boolean;
  /** Topics already discussed (deduped, capped at 30 entries) */
  topics_discussed: string[];
  /** Things the coach committed to bring back later */
  pending_followups: CoachPendingFollowup[];
  /** Learned tone preference */
  response_style: CoachResponseStyle;
  /** First-login welcome already sent? */
  welcome_sent: boolean;
  /** Post-onboarding plan-debrief already sent? */
  plan_debrief_sent: boolean;
  /** Free-text personality calibration notes (coach writes this itself) */
  personality_notes?: string;
  created_at: string;
  updated_at: string;
}

export const DEFAULT_COACH_STATE: Omit<CoachState, 'created_at' | 'updated_at'> = {
  has_unread_intervention: false,
  topics_discussed: [],
  pending_followups: [],
  response_style: 'mixed',
  welcome_sent: false,
  plan_debrief_sent: false,
};

/** Cap topics_discussed to avoid unbounded growth in the prompt. */
export const MAX_TOPICS_DISCUSSED = 30;
