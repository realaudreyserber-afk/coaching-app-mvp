/**
 * Curated French/EU scientific source registry.
 * Used to add FR-language results to the RAG search pool alongside PubMed (EN).
 * Each entry maps a domain to a normalized SearchResult template.
 *
 * Strategy: when the coach asks about a topic, we run a Google Site Search
 * (via Custom Search Engine) restricted to these domains. CSE_API_KEY +
 * CSE_FR_ENGINE_ID required at runtime; otherwise this returns [] silently.
 */

export interface FrSource {
  domain: string;
  org: string;
  authorityScore: number; // 1-10, used to rank
}

export const FR_AUTHORITY_SOURCES: FrSource[] = [
  { domain: 'anses.fr',       org: 'ANSES',                authorityScore: 10 },
  { domain: 'inserm.fr',      org: 'INSERM',               authorityScore: 10 },
  { domain: 'has-sante.fr',   org: 'Haute Autorité Santé', authorityScore: 10 },
  { domain: 'sante.fr',       org: 'Santé Publique France',authorityScore: 9  },
  { domain: 'who.int',        org: 'OMS',                  authorityScore: 9  },
  { domain: 'efsa.europa.eu', org: 'EFSA',                 authorityScore: 9  },
  { domain: 'espen.org',      org: 'ESPEN',                authorityScore: 8  },
  { domain: 'mangerbouger.fr',org: 'PNNS',                 authorityScore: 7  },
  { domain: 'ameli.fr',       org: 'Assurance Maladie',    authorityScore: 7  },
];

export interface FrSearchResult {
  title: string;
  url: string;
  org: string;
  snippet?: string;
}

export async function searchFrCorpus(query: string, limit = 3): Promise<FrSearchResult[]> {
  const apiKey = process.env.CSE_API_KEY;
  const engineId = process.env.CSE_FR_ENGINE_ID;
  if (!apiKey || !engineId) return [];

  try {
    const url = new URL('https://www.googleapis.com/customsearch/v1');
    url.searchParams.set('key', apiKey);
    url.searchParams.set('cx', engineId);
    url.searchParams.set('q', query);
    url.searchParams.set('num', String(Math.min(limit, 10)));
    url.searchParams.set('hl', 'fr');
    url.searchParams.set('lr', 'lang_fr');

    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'LinsociableCoach/1.0' },
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.items?.length) return [];

    return data.items.slice(0, limit).map((item: { title: string; link: string; snippet?: string }) => {
      const domain = (() => {
        try { return new URL(item.link).hostname.replace(/^www\./, ''); } catch { return ''; }
      })();
      const match = FR_AUTHORITY_SOURCES.find(s => domain.endsWith(s.domain));
      return {
        title: item.title,
        url: item.link,
        org: match?.org ?? domain,
        snippet: item.snippet,
      };
    });
  } catch (err) {
    console.warn('FR corpus search failed:', err);
    return [];
  }
}
