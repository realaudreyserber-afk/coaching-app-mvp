import { describe, it, expect } from 'vitest';
import { normalizeForSafety, normalizeKeywords, SUICIDE_KEYWORDS_FR, TCA_KEYWORDS_FR } from './safety-dict.fr';

describe('normalizeForSafety', () => {
  it('lowercases and replaces typographic apostrophes', () => {
    expect(normalizeForSafety("M'AUTOMUTILER")).toBe("m'automutiler");
    expect(normalizeForSafety('m’automutiler')).toBe("m'automutiler");
    expect(normalizeForSafety('m‘automutiler')).toBe("m'automutiler");
  });

  it('strips diacritics for accent-insensitive matching', () => {
    expect(normalizeForSafety('Jeûne punitif')).toBe('jeune punitif');
    expect(normalizeForSafety('vomir après')).toBe('vomir apres');
  });

  it('handles empty/null gracefully', () => {
    expect(normalizeForSafety('')).toBe('');
    expect(normalizeForSafety(undefined as unknown as string)).toBe('');
  });
});

describe('safety dictionaries', () => {
  it('SUICIDE_KEYWORDS_FR is non-empty and includes 3114-related signals', () => {
    expect(SUICIDE_KEYWORDS_FR.length).toBeGreaterThan(5);
    expect(SUICIDE_KEYWORDS_FR).toContain('en finir');
  });

  it('TCA_KEYWORDS_FR catches compensatory behaviors', () => {
    expect(TCA_KEYWORDS_FR).toContain('laxatifs');
    expect(TCA_KEYWORDS_FR.some(k => k.includes('vomir'))).toBe(true);
  });

  it('normalizeKeywords applies normalization to every entry', () => {
    const norm = normalizeKeywords(['Café', 'Jeûne PUNITIF']);
    expect(norm).toEqual(['cafe', 'jeune punitif']);
  });
});
