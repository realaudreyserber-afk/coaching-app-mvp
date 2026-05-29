import { describe, it, expect, vi } from 'vitest';

// coach-route-adapter.ts imports `server-only` (throws under vitest) plus
// next/server and ./supervisor. Stub them so we can import stripCoachTags.
vi.mock('server-only', () => ({}));
vi.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: { json: vi.fn() },
}));
vi.mock('./supervisor', () => ({ runAgentSession: vi.fn() }));

import { stripCoachTags } from './coach-route-adapter';

describe('coach-route-adapter — stripCoachTags', () => {
  it('returns plain text unchanged (aside from trailing trim)', () => {
    expect(stripCoachTags('Bonjour, voici ton plan.')).toBe('Bonjour, voici ton plan.');
  });

  it('removes a complete COACH_SAVE block but keeps surrounding text', () => {
    const input =
      'Avant.<COACH_SAVE>{"weight":80}</COACH_SAVE>Après.';
    expect(stripCoachTags(input)).toBe('Avant.Après.');
  });

  it('removes a complete COACH_PLAN_PATCH block but keeps surrounding text', () => {
    const input = 'Texte.<COACH_PLAN_PATCH>{"kcal":2400}</COACH_PLAN_PATCH> suite';
    expect(stripCoachTags(input)).toBe('Texte. suite');
  });

  it('removes both tag types in the same message', () => {
    const input =
      'A<COACH_SAVE>x</COACH_SAVE>B<COACH_PLAN_PATCH>y</COACH_PLAN_PATCH>C';
    expect(stripCoachTags(input)).toBe('ABC');
  });

  it('strips a multiline tag body', () => {
    const input = 'Intro\n<COACH_SAVE>\n{\n  "a": 1\n}\n</COACH_SAVE>\nOutro';
    const out = stripCoachTags(input);
    expect(out).toContain('Intro');
    expect(out).toContain('Outro');
    expect(out).not.toContain('COACH_SAVE');
    expect(out).not.toContain('"a"');
  });

  it('strips an unterminated opening tag from the tag onward (truncated generation)', () => {
    const input = 'Réponse coach complète.\n<COACH_SAVE>{"weight": 80, "ener';
    expect(stripCoachTags(input)).toBe('Réponse coach complète.');
  });

  it('strips an unterminated COACH_PLAN_PATCH opening tag to the end', () => {
    const input = 'Garde ça.<COACH_PLAN_PATCH>{"kcal":';
    expect(stripCoachTags(input)).toBe('Garde ça.');
  });

  it('trims trailing whitespace from the result', () => {
    expect(stripCoachTags('Texte final.   \n\n')).toBe('Texte final.');
  });

  it('handles multiple consecutive COACH_SAVE blocks (global replace)', () => {
    const input = '<COACH_SAVE>a</COACH_SAVE><COACH_SAVE>b</COACH_SAVE>fin';
    expect(stripCoachTags(input)).toBe('fin');
  });

  // Cas balise FERMANTE orpheline (sans ouvrante) — ne doit pas survivre dans
  // l'historique chat. Avant le fix, ces tags restaient visibles.
  it('removes an orphan COACH_SAVE closing tag with no opener', () => {
    const out = stripCoachTags('Bonjour </COACH_SAVE> voici la suite.');
    expect(out).not.toContain('COACH_SAVE');
    expect(out).toContain('Bonjour');
    expect(out).toContain('voici la suite.');
  });

  it('removes an orphan COACH_PLAN_PATCH closing tag with no opener', () => {
    expect(stripCoachTags('Suite</COACH_PLAN_PATCH>fin')).toBe('Suitefin');
  });

  it('removes a residual orphan closing tag left after a complete block', () => {
    // Le bloc complet est retiré, laissant une fermante orpheline → doit partir.
    const input = 'A<COACH_SAVE>x</COACH_SAVE>B</COACH_SAVE>C';
    expect(stripCoachTags(input)).toBe('ABC');
  });

  it('strips an orphan closing tag sitting at the very end', () => {
    expect(stripCoachTags('Texte final.</COACH_SAVE>')).toBe('Texte final.');
  });
});
