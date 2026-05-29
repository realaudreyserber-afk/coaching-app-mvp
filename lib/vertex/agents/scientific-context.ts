/**
 * fetchScientificSources — sources scientifiques RÉELLES pour grounder les
 * citations d'un sous-agent (anti-hallucination).
 *
 * Branché identiquement dans nutrition / planning / analytics / education.
 * Sans lui, ces agents citaient Helms/Phillips/Garthe depuis la mémoire
 * paramétrique du LLM → références fabriquées (mauvaise année/finding) sur le
 * domaine le plus chiffré (audit 2026-05-29, critical). Le prompt de chaque
 * agent doit imposer : "cite UNIQUEMENT depuis context.scientific_sources ;
 * sinon citations:[] + baisse confidence".
 *
 * Best-effort : retourne [] en cas d'échec (pas de citation > citation inventée).
 */

import 'server-only';
import { searchScientificCorpus } from '@/lib/features/rag-sourcing/client';

export interface ScientificSource {
  title: string;
  authors: string;
  source: string;
  year: string;
  url: string;
}

export async function fetchScientificSources(query: string): Promise<ScientificSource[]> {
  if (!query || query.trim().length < 8) return [];
  try {
    const sources = await searchScientificCorpus(query);
    return (sources ?? []).slice(0, 5).map((s) => ({
      title: s.title,
      authors: s.authors,
      source: s.source,
      year: s.year,
      url: s.url,
    }));
  } catch (e) {
    console.warn('[scientific-context] fetch failed:', e);
    return [];
  }
}
