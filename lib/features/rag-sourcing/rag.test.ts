import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildRAGPrompt } from './prompts';
import { searchScientificCorpus } from './client';

describe('RAG Sourcing Sourcing & Prompts', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('buildRAGPrompt', () => {
    it('should return the original prompt if search results list is empty', () => {
      const original = 'How much protein is needed for hypertrophy?';
      const prompt = buildRAGPrompt(original, []);
      expect(prompt).toBe(original);
    });

    it('should inject formatted references into the prompt when present', () => {
      const original = 'Hypertrophy intake';
      const sources = [
        {
          title: 'Protein timing and hypertrophy',
          authors: 'Helms et al.',
          source: 'JISSN',
          year: '2022',
          pmid: '3512345',
          url: 'https://pubmed.local/3512345',
        },
      ];

      const prompt = buildRAGPrompt(original, sources);
      expect(prompt).toContain('timing and hypertrophy');
      expect(prompt).toContain('Helms et al.');
      expect(prompt).toContain('Source #1');
      expect(prompt).toContain('PMID: 3512345');
      expect(prompt).toContain('CONSIGNES STRICTES DE CITATION');
    });
  });

  describe('searchScientificCorpus PubMed search', () => {
    it('should call PubMed API and map response elements correctly', async () => {
      const mockSearchResponse = {
        esearchresult: {
          idlist: ['111111', '222222'],
        },
      };

      const mockSummaryResponse = {
        result: {
          uids: ['111111', '222222'],
          '111111': {
            title: 'Effects of protein timing on muscle protein synthesis',
            authors: [{ name: 'Morton RW' }, { name: 'Phillips SM' }],
            source: 'Sports Med',
            pubdate: '2018 Mar 1',
          },
          '222222': {
            title: 'Dietary protein recommendations for athletes',
            authors: [{ name: 'Helms ER' }],
            source: 'Nutrients',
            pubdate: '2014 Jun 2',
          },
        },
      };

      const mockFetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('esearch.fcgi')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockSearchResponse),
          });
        }
        if (url.includes('esummary.fcgi')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockSummaryResponse),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      vi.stubGlobal('fetch', mockFetch);

      const results = await searchScientificCorpus('protein timing');
      
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(results.length).toBe(2);
      expect(results[0].title).toBe('Effects of protein timing on muscle protein synthesis');
      expect(results[0].authors).toBe('Morton RW et al.');
      expect(results[0].year).toBe('2018');
      expect(results[1].authors).toBe('Helms ER');
      expect(results[1].year).toBe('2014');
    });

    it('should return empty list on API failures', async () => {
      const mockFetch = vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: false,
          status: 500,
        })
      );
      vi.stubGlobal('fetch', mockFetch);

      const results = await searchScientificCorpus('protein');
      expect(results).toEqual([]);
    });
  });
});
