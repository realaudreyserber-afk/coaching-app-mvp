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
import type { AgentInput, SubAgentName } from '../types';

export class MentalCoach extends BaseAgent {
  readonly name: SubAgentName = 'mental';
  readonly systemPrompt = MENTAL_SYSTEM_PROMPT;
  readonly temperature = 0.5; // un peu plus de chaleur conversationnelle

  protected async fetchContext(input: AgentInput): Promise<Record<string, unknown>> {
    const ctx: Record<string, unknown> = {};
    const userRef = adminDb.collection('users').doc(input.uid);

    // coach_state.response_style
    try {
      const snap = await userRef.collection('coach_state').doc('state').get();
      const state = snap.data();
      if (state) {
        ctx.coach_state = {
          response_style: state.response_style,
          tone_preferences: state.tone_preferences,
          do_not_repeat: state.do_not_repeat,
        };
      }
    } catch (e) {
      console.warn('[mental-agent] coach_state fetch failed:', e);
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

    return ctx;
  }
}
