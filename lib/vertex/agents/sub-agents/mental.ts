/**
 * MentalCoach — sous-agent émotionnel/motivationnel léger.
 *
 * Pas de signaux critiques (→ safety). Pas de chiffres (→ autres agents).
 * Focus : reformulation, validation, gestion fatigue mentale, doute,
 * démotivation, célébration des wins.
 *
 * fetchContext :
 *  - coach_state.response_style (préférences ton de l'user)
 *  - recent_chat est déjà passé par le Supervisor dans input.recent_chat
 *  - dernier session_debrief (pour ne pas répéter)
 */

import 'server-only';
import { adminDb } from '@/lib/firebase/admin';
import { BaseAgent } from './base';
import { MENTAL_SYSTEM_PROMPT } from '../../prompts/agents/mental';
import { getCycleSnapshot } from '@/lib/features/cycle/store';
import { getSubstancesSnapshot } from '@/lib/features/substances/store';
import { getCravingsSnapshot } from '@/lib/features/cravings/store';
import { getLifeEventsSnapshot } from '@/lib/features/life-events/store';
import { getGoalsHistorySnapshot } from '@/lib/features/goals-history/store';
import { getHabitsSnapshot } from '@/lib/features/habits/store';
import { type NormalizedProfile } from '@/lib/features/user-profile/snapshot';
import { resolveProfileSnapshot } from '../profile-cache';
import type { AgentInput, SubAgentName } from '../types';

export class MentalCoach extends BaseAgent {
  readonly name: SubAgentName = 'mental';
  readonly systemPrompt = MENTAL_SYSTEM_PROMPT;
  readonly temperature = 0.5; // un peu plus de chaleur conversationnelle

  protected async fetchContext(input: AgentInput): Promise<Record<string, unknown>> {
    const ctx: Record<string, unknown> = {};
    const userRef = adminDb.collection('users').doc(input.uid);

    let profile: NormalizedProfile | null = null;
    try {
      profile = await resolveProfileSnapshot(input);
    } catch (e) {
      console.warn('[mental-agent] profile fetch failed:', e);
    }

    // coach_state.response_style
    // Audit 2026-05-28 #12 : doc-id était 'state' alors que tout le reste de la
    // codebase (store, proactive, plateau-detector) lit/écrit doc('main') →
    // response_style/do_not_repeat toujours vides, règle mental §3 morte.
    try {
      const snap = await userRef.collection('coach_state').doc('main').get();
      const state = snap.data();
      if (state) {
        ctx.coach_state = {
          response_style: state.response_style,
          // Audit 2026-05-29 : tone_preferences/do_not_repeat n'existent PAS dans
          // le schéma CoachState (toujours undefined → mémoire anti-répétition
          // morte). Vrais champs : topics_discussed + personality_notes.
          topics_discussed: state.topics_discussed,
          personality_notes: state.personality_notes,
        };
      }
    } catch (e) {
      console.warn('[mental-agent] coach_state fetch failed:', e);
    }

    // Goals timeline — pour gauger motivation vs durée engagée
    if (profile?.goals) {
      ctx.goals = {
        type: profile.goals.type,
        target_date: profile.goals.target_date,
        duration_chosen_weeks: profile.goals.duration_chosen_weeks,
      };
    }

    // Dernier session_debrief
    try {
      const snap = await userRef
        .collection('session_debriefs')
        .orderBy('created_at', 'desc')
        .limit(1)
        .get();
      const last = snap.docs[0]?.data();
      if (last) {
        ctx.last_debrief = {
          created_at: last.created_at,
          summary: last.summary,
          mood_trend: last.mood_trend,
        };
      }
    } catch (e) {
      console.warn('[mental-agent] last_debrief fetch failed:', e);
    }

    // Recent_chat est déjà dans input — exposer en context pour clarté
    if (input.recent_chat && input.recent_chat.length > 0) {
      ctx.recent_chat = input.recent_chat;
    }

    // Cycle menstruel (si féminin) — valider fluctuations mood comme physiologiques
    if (profile?.sex === 'female') {
      try {
        const cycle = await getCycleSnapshot(input.uid);
        if (cycle) ctx.cycle = cycle;
      } catch (e) {
        console.warn('[mental-agent] cycle fetch failed:', e);
      }
    }

    // Substances — caféine excessive impacte cortisol + anxiété ; alcool = depressant
    try {
      const substances = await getSubstancesSnapshot(input.uid);
      if (substances) ctx.substances = substances;
    } catch (e) {
      console.warn('[mental-agent] substances fetch failed:', e);
    }

    // Cravings — pattern triggers émotionnels (stress, soir, post-séance)
    try {
      const cravings = await getCravingsSnapshot(input.uid);
      if (cravings) ctx.cravings = cravings;
    } catch (e) {
      console.warn('[mental-agent] cravings fetch failed:', e);
    }

    // Life events — Phase 8 (contexte burnout, deuil, déménagement, etc.)
    try {
      const lifeEvents = await getLifeEventsSnapshot(input.uid);
      if (lifeEvents) ctx.life_events = lifeEvents;
    } catch (e) {
      console.warn('[mental-agent] life_events fetch failed:', e);
    }

    // Goals history — Phase 10 (changements fréquents = pattern d'abandon)
    try {
      const goalsHistory = await getGoalsHistorySnapshot(input.uid);
      if (goalsHistory) ctx.goals_history = goalsHistory;
    } catch (e) {
      console.warn('[mental-agent] goals_history fetch failed:', e);
    }

    // Habits — Phase 11 (streaks + adherence pattern)
    try {
      const habits = await getHabitsSnapshot(input.uid);
      if (habits) ctx.habits = habits;
    } catch (e) {
      console.warn('[mental-agent] habits fetch failed:', e);
    }

    return ctx;
  }
}
