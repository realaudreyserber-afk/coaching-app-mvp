/**
 * SocialCoach — sous-agent pression sociale / sorties / contexte humain.
 *
 * fetchContext (léger) :
 *  - profile (lifestyle, household, work)
 *  - recent_chat (déjà dans input)
 */

import 'server-only';
import { BaseAgent } from './base';
import { SOCIAL_SYSTEM_PROMPT } from '../../prompts/agents/social';
import { resolveProfileSnapshot } from '../profile-cache';
import type { AgentInput, SubAgentName } from '../types';

export class SocialCoach extends BaseAgent {
  readonly name: SubAgentName = 'social';
  readonly systemPrompt = SOCIAL_SYSTEM_PROMPT;
  readonly temperature = 0.4;

  protected async fetchContext(input: AgentInput): Promise<Record<string, unknown>> {
    const ctx: Record<string, unknown> = {};

    try {
      const profile = await resolveProfileSnapshot(input);
      ctx.profile = {
        household: profile.household,
        work_context: profile.work_context,
        lifestyle: profile.lifestyle,
        travel_frequency: profile.travel_frequency,
        relationship_status: profile.relationship_status,
      };
    } catch (e) {
      console.warn('[social-agent] profile fetch failed:', e);
    }

    if (input.recent_chat && input.recent_chat.length > 0) {
      ctx.recent_chat = input.recent_chat;
    }

    return ctx;
  }
}
