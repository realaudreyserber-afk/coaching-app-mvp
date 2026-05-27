/**
 * EducationCoach — sous-agent vulgarisation scientifique.
 *
 * Pas de data perso (→ autres agents si l'user veut applic). Source-driven.
 *
 * fetchContext :
 *  - searchScientificCorpus(query) — sources scientifiques pertinentes
 */

import 'server-only';
import { BaseAgent } from './base';
import { EDUCATION_SYSTEM_PROMPT } from '../../prompts/agents/education';
import { searchScientificCorpus } from '@/lib/features/rag-sourcing/client';
import type { AgentInput, SubAgentName } from '../types';

export class EducationCoach extends BaseAgent {
  readonly name: SubAgentName = 'education';
  readonly systemPrompt = EDUCATION_SYSTEM_PROMPT;
  readonly temperature = 0.2;

  protected async fetchContext(input: AgentInput): Promise<Record<string, unknown>> {
    const ctx: Record<string, unknown> = {};

    try {
      const sources = await searchScientificCorpus(input.user_message);
      if (sources && sources.length > 0) {
        ctx.scientific_sources = sources.slice(0, 5).map((s) => ({
          title: s.title,
          authors: s.authors,
          source: s.source,
          year: s.year,
          url: s.url,
          abstractSnippet: s.abstractSnippet,
        }));
      }
    } catch (e) {
      console.warn('[education-agent] scientific corpus fetch failed:', e);
    }

    return ctx;
  }
}
