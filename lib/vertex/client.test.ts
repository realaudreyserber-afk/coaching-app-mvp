import { describe, it, expect } from 'vitest';
import { parseLLMJson } from './client';

describe('client — parseLLMJson', () => {
  it('parses a bare JSON object', () => {
    const out = parseLLMJson<{ a: number; b: string }>('{"a": 1, "b": "x"}');
    expect(out).toEqual({ a: 1, b: 'x' });
  });

  it('parses JSON wrapped in ```json fences', () => {
    const raw = '```json\n{"severity": "critical", "ok": true}\n```';
    const out = parseLLMJson<{ severity: string; ok: boolean }>(raw);
    expect(out.severity).toBe('critical');
    expect(out.ok).toBe(true);
  });

  it('parses JSON wrapped in bare ``` fences (no language tag)', () => {
    const raw = '```\n{"n": 42}\n```';
    expect(parseLLMJson<{ n: number }>(raw)).toEqual({ n: 42 });
  });

  it('strips a leading "json\\n" prefix without fences', () => {
    const out = parseLLMJson<{ k: string }>('json\n{"k": "v"}');
    expect(out).toEqual({ k: 'v' });
  });

  it('extracts an embedded JSON object surrounded by prose', () => {
    const raw = 'Voici la réponse : {"diagnostic": "ok", "score": 3} — fin du texte.';
    const out = parseLLMJson<{ diagnostic: string; score: number }>(raw);
    expect(out).toEqual({ diagnostic: 'ok', score: 3 });
  });

  it('parses an array', () => {
    expect(parseLLMJson<number[]>('[1, 2, 3]')).toEqual([1, 2, 3]);
  });

  it('throws on an empty string', () => {
    expect(() => parseLLMJson('')).toThrow(/Empty LLM response/);
  });

  it('throws on a non-string input', () => {
    // @ts-expect-error — intentionally passing wrong type to assert guard
    expect(() => parseLLMJson(null)).toThrow(/Empty LLM response/);
  });

  it('throws on pure garbage with no extractable JSON', () => {
    expect(() => parseLLMJson('this is not json at all')).toThrow(/parse failed/);
  });

  it('throws on a truncated/broken JSON object', () => {
    // No closing brace and no valid slice possible.
    expect(() => parseLLMJson('{"a": 1, "b":')).toThrow(/parse failed/);
  });
});
