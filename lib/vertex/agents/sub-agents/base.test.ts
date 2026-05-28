import { describe, it, expect, vi, beforeEach } from 'vitest';

// base.ts imports `server-only` (throws under vitest) + the Vertex client.
// Stub server-only; mock the client's network call but keep the real
// parseLLMJson so the parse path under test is authentic.
vi.mock('server-only', () => ({}));
vi.mock('../tracing', () => ({
  tracer: { forSession: () => ({ agent: vi.fn(), captureError: vi.fn() }) },
}));

// vi.mock is hoisted above top-level consts, so the mock fn must be created
// via vi.hoisted() to be available inside the factory.
const { generateTextWithUsage } = vi.hoisted(() => ({ generateTextWithUsage: vi.fn() }));
vi.mock('../../client', async () => {
  const actual = await vi.importActual<typeof import('../../client')>('../../client');
  return { ...actual, generateTextWithUsage };
});

import { BaseAgent } from './base';
import type { AgentInput, AgentOutput, SharedSessionMemory, SubAgentName } from '../types';
import { createEmptySharedMemory } from '../types';

// Minimal concrete agent: parseOutput is private, so we exercise it through
// the observable run() pipeline (the least-invasive option per the brief).
class TestAgent extends BaseAgent {
  readonly name: SubAgentName = 'nutrition';
  readonly systemPrompt = 'test';
  protected async fetchContext(): Promise<Record<string, unknown>> {
    return {};
  }
}

const input: AgentInput = {
  session_id: 's',
  uid: 'u',
  user_message: 'hi',
  reason_for_consult: 'r',
};
let mem: SharedSessionMemory;

/** Helper: stub the LLM to return `raw`, run the agent, return its output. */
async function runWith(raw: string): Promise<AgentOutput> {
  generateTextWithUsage.mockResolvedValueOnce({ text: raw, tokens: { input: 10, output: 5 } });
  return new TestAgent().run(input, mem);
}

beforeEach(() => {
  generateTextWithUsage.mockReset();
  mem = createEmptySharedMemory();
});

describe('base — parseOutput (via run pipeline)', () => {
  it('parses a well-formed output and stamps agent/tokens/duration', async () => {
    const out = await runWith(
      JSON.stringify({
        diagnostic: 'all good',
        recommendations: ['eat protein', 'sleep'],
        severity: 'warning',
        confidence: 'high',
      }),
    );
    expect(out.agent).toBe('nutrition');
    expect(out.diagnostic).toBe('all good');
    expect(out.recommendations).toEqual(['eat protein', 'sleep']);
    expect(out.severity).toBe('warning');
    expect(out.confidence).toBe('high');
    expect(out.tokens).toEqual({ input: 10, output: 5 });
    expect(typeof out.duration_ms).toBe('number');
    expect(out.error).toBeUndefined();
  });

  it('falls back to severity=info when severity enum is invalid', async () => {
    const out = await runWith(
      JSON.stringify({ diagnostic: 'x', recommendations: [], severity: 'apocalyptic', confidence: 'high' }),
    );
    expect(out.severity).toBe('info');
    expect(out.confidence).toBe('high');
  });

  it('falls back to confidence=medium when confidence enum is invalid', async () => {
    const out = await runWith(
      JSON.stringify({ diagnostic: 'x', recommendations: [], severity: 'critical', confidence: 'absolute' }),
    );
    expect(out.confidence).toBe('medium');
    expect(out.severity).toBe('critical');
  });

  it('defaults both enums when omitted entirely', async () => {
    const out = await runWith(JSON.stringify({ diagnostic: 'x', recommendations: [] }));
    expect(out.severity).toBe('info');
    expect(out.confidence).toBe('medium');
  });

  it('coerces a non-array recommendations field to an empty array', async () => {
    const out = await runWith(
      JSON.stringify({ diagnostic: 'x', recommendations: 'just one string', severity: 'info', confidence: 'low' }),
    );
    expect(out.recommendations).toEqual([]);
  });

  it('stringifies non-string recommendation entries', async () => {
    const out = await runWith(
      JSON.stringify({ diagnostic: 'x', recommendations: [1, true, 'ok'], severity: 'info', confidence: 'low' }),
    );
    expect(out.recommendations).toEqual(['1', 'true', 'ok']);
  });

  it('defaults diagnostic to "" when missing or non-string', async () => {
    const out = await runWith(JSON.stringify({ recommendations: [], severity: 'info', confidence: 'low' }));
    expect(out.diagnostic).toBe('');
  });

  it('keeps only citations that have a string label', async () => {
    const out = await runWith(
      JSON.stringify({
        diagnostic: 'x',
        recommendations: [],
        severity: 'info',
        confidence: 'low',
        citations: [
          { label: 'Helms 2022', url: 'https://x' },
          { url: 'https://no-label' },
          { label: 42 },
          null,
          { label: 'Schoenfeld' },
        ],
      }),
    );
    expect(out.citations).toEqual([
      { label: 'Helms 2022', url: 'https://x' },
      { label: 'Schoenfeld' },
    ]);
  });

  it('sets citations to undefined when none survive filtering', async () => {
    const out = await runWith(
      JSON.stringify({
        diagnostic: 'x',
        recommendations: [],
        severity: 'info',
        confidence: 'low',
        citations: [{ url: 'https://no-label' }, { label: 99 }],
      }),
    );
    expect(out.citations).toBeUndefined();
  });

  it('filters request_consult to valid sub-agent names only', async () => {
    const out = await runWith(
      JSON.stringify({
        diagnostic: 'x',
        recommendations: [],
        severity: 'info',
        confidence: 'low',
        request_consult: ['training', 'bogus', 'safety', 123, null],
      }),
    );
    expect(out.request_consult).toEqual(['training', 'safety']);
  });

  it('sets request_consult to undefined when no valid names remain', async () => {
    const out = await runWith(
      JSON.stringify({
        diagnostic: 'x',
        recommendations: [],
        severity: 'info',
        confidence: 'low',
        request_consult: ['bogus', 'supervisor'],
      }),
    );
    expect(out.request_consult).toBeUndefined();
  });

  it('passes raw_data through untouched', async () => {
    const out = await runWith(
      JSON.stringify({
        diagnostic: 'x',
        recommendations: [],
        severity: 'info',
        confidence: 'low',
        raw_data: { kcal: 2400, flag: true },
      }),
    );
    expect(out.raw_data).toEqual({ kcal: 2400, flag: true });
  });

  it('returns a safe error output (no throw) when the LLM returns garbage', async () => {
    // parseLLMJson throws on non-JSON → run() catches and returns minimal output.
    const out = await runWith('totally not json');
    expect(out.agent).toBe('nutrition');
    expect(out.severity).toBe('info');
    expect(out.confidence).toBe('low');
    expect(out.recommendations).toEqual([]);
    expect(out.error).toBeTruthy();
  });
});
