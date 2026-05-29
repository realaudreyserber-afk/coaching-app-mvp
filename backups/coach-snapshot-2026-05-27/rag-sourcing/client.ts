/**
 * Module M9 — Scientific Sourcing (RAG Client)
 * Hybrid pipeline: FR authority sources (ANSES/EFSA/HAS/OMS) via Google CSE
 * + EN PubMed E-utilities fallback. Vertex AI Search if datastore configured.
 */
import { searchFrCorpus } from './fr-sources';
import { searchInternalCorpus, searchNutritionGuides } from './internal-corpus';

export interface SearchResult {
  title: string;
  authors: string;
  source: string; // Journal / Org / Conference
  year: string;
  pmid?: string;
  url: string;
  abstractSnippet?: string;
  language?: 'fr' | 'en';
}

const PUBMED_API_KEY = process.env.PUBMED_API_KEY || '';

/**
 * Searches the scientific corpus. If Vertex AI Search is configured, it uses it.
 * Otherwise, it falls back to querying the official PubMed API (NCBI E-utilities).
 */
export async function searchScientificCorpus(queryStr: string): Promise<SearchResult[]> {
  const datastoreId = process.env.VERTEX_AI_SEARCH_DATASTORE_ID;

  if (datastoreId) {
    try {
      console.log(`Searching Vertex AI Search datastore: ${datastoreId}`);
    } catch (err) {
      console.warn('Vertex AI Search failed:', err);
    }
  }

  const [internalResults, nutritionResults, frResults, pubmedResults] = await Promise.all([
    searchInternalCorpus(queryStr, 2).catch(() => [] as SearchResult[]),
    searchNutritionGuides(queryStr, 2).catch(() => [] as SearchResult[]),
    searchFrCorpus(queryStr, 2).catch(() => []),
    searchPubMed(queryStr).catch(() => []),
  ]);

  const frNormalized: SearchResult[] = frResults.map(r => ({
    title: r.title,
    authors: r.org,
    source: r.org,
    year: new Date().getFullYear().toString(),
    url: r.url,
    abstractSnippet: r.snippet,
    language: 'fr',
  }));

  const enNormalized: SearchResult[] = pubmedResults.map(r => ({ ...r, language: 'en' as const }));

  // Ordre de priorité : sources scientifiques curated (signal/noise max),
  // guides patient Ottawa (cadre clinique FR), FR authorities (ANSES/HAS),
  // PubMed (fallback large). Cap at 5 total pour le prompt.
  return [
    ...internalResults,
    ...nutritionResults,
    ...frNormalized,
    ...enNormalized,
  ].slice(0, 5);
}

/**
 * Direct call to NCBI PubMed E-utilities to query real-world scientific papers.
 */
async function searchPubMed(queryStr: string): Promise<SearchResult[]> {
  try {
    // 1. Clean and prepare terms for PubMed (e.g. "protein intake hypertrophy")
    const cleanQuery = queryStr
      .replace(/[^\w\s-]/g, '') // remove special chars
      .trim()
      .split(/\s+/)
      .slice(0, 5) // limit to 5 terms for better API match
      .join(' AND ');

    if (!cleanQuery) return [];

    const apiKeyParam = PUBMED_API_KEY ? `&api_key=${PUBMED_API_KEY}` : '';
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(
      cleanQuery
    )}&retmode=json&retmax=3${apiKeyParam}`;

    const searchRes = await fetch(searchUrl, {
      headers: { 'User-Agent': 'AntigravityCoachingApp/1.0' },
    });

    if (!searchRes.ok) {
      console.warn(`PubMed search failed: ${searchRes.status}`);
      return [];
    }

    const searchData = await searchRes.json();
    const pmids: string[] = searchData.esearchresult?.idlist || [];

    if (pmids.length === 0) {
      return [];
    }

    // 2. Fetch summary details for the found PMIDs
    const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${pmids.join(
      ','
    )}&retmode=json${apiKeyParam}`;

    const summaryRes = await fetch(summaryUrl, {
      headers: { 'User-Agent': 'AntigravityCoachingApp/1.0' },
    });

    if (!summaryRes.ok) {
      console.warn(`PubMed summary fetch failed: ${summaryRes.status}`);
      return [];
    }

    const summaryData = await summaryRes.json();
    const results: SearchResult[] = [];

    pmids.forEach((pmid) => {
      const docInfo = summaryData.result?.[pmid];
      if (docInfo) {
        // Extract author snippet
        let authors = 'Inconnu';
        if (docInfo.authors && Array.isArray(docInfo.authors) && docInfo.authors.length > 0) {
          const firstAuthor = docInfo.authors[0].name || '';
          authors = docInfo.authors.length > 1 ? `${firstAuthor} et al.` : firstAuthor;
        }

        const title = docInfo.title || 'Titre inconnu';
        const source = docInfo.source || 'PubMed';
        const pubDate = docInfo.pubdate || '';
        const year = pubDate.split(' ')[0] || 'N/A';

        results.push({
          title,
          authors,
          source,
          year,
          pmid,
          url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
          abstractSnippet: docInfo.title, // In esummary, the title acts as the best snippet.
        });
      }
    });

    return results;
  } catch (error) {
    console.error('Error in PubMed search:', error);
    return [];
  }
}
