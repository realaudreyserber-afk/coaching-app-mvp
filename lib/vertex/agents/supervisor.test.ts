import { describe, it, expect, vi } from 'vitest';

// supervisor.ts imports `server-only` (throws under vitest/node) and pulls in
// heavy/side-effecting deps. We only want to unit-test the pure parsing &
// arbitration helpers, so we stub everything except the real parseLLMJson
// (which parseRoutingDecision relies on for its JSON behavior).
vi.mock('server-only', () => ({}));
vi.mock('../prompts/agents/supervisor', () => ({ SUPERVISOR_SYSTEM_PROMPT: 'stub' }));
vi.mock('./sub-agents', () => ({ getSubAgent: vi.fn() }));
vi.mock('./tracing', () => ({
  generateSessionId: () => 'sess_test',
  tracer: { forSession: () => ({ supervisor: vi.fn(), agent: vi.fn(), captureError: vi.fn() }) },
}));
vi.mock('./shared-memory', () => ({
  persistSessionRecord: vi.fn(),
  estimateCostUsd: () => 0,
}));
// client.ts imports the Vertex/Gemini SDKs; mock generateTextWithUsage but keep
// the REAL parseLLMJson so parse behavior under test is authentic.
vi.mock('../client', async () => {
  const actual = await vi.importActual<typeof import('../client')>('../client');
  return { ...actual, generateTextWithUsage: vi.fn() };
});

import {
  parseRoutingDecision,
  arbitrateOutputs,
  mentionsPregnancy,
  enforcePregnancySafety,
  buildAggregatePrompt,
} from './supervisor';
import type { AgentOutput, RoutingDecision, SubAgentName } from './types';

function makeOutput(agent: SubAgentName, severity: AgentOutput['severity']): AgentOutput {
  return {
    agent,
    diagnostic: 'd',
    recommendations: [],
    severity,
    confidence: 'medium',
  };
}

describe('supervisor — parseRoutingDecision', () => {
  it('parses a valid decision with two known agents', () => {
    const raw = JSON.stringify({
      sub_agents: [
        { name: 'nutrition', reason_for_consult: 'macros' },
        { name: 'training', reason_for_consult: 'volume' },
      ],
      reasoning: 'both relevant',
    });
    const out = parseRoutingDecision(raw);
    expect(out.sub_agents).toEqual([
      { name: 'nutrition', reason_for_consult: 'macros' },
      { name: 'training', reason_for_consult: 'volume' },
    ]);
    expect(out.reasoning).toBe('both relevant');
    expect(out.skip_sub_agents).toBe(false);
    expect(out.direct_response).toBeUndefined();
  });

  it('coerces a non-array sub_agents field to an empty list', () => {
    const out = parseRoutingDecision(JSON.stringify({ sub_agents: 'nutrition', reasoning: 'x' }));
    expect(out.sub_agents).toEqual([]);
    expect(out.reasoning).toBe('x');
  });

  it('filters out invalid sub-agent names, keeping only valid ones', () => {
    const raw = JSON.stringify({
      sub_agents: [
        { name: 'nutrition', reason_for_consult: 'ok' },
        { name: 'bogus', reason_for_consult: 'nope' },
        { name: 'supervisor', reason_for_consult: 'not a sub-agent' },
        { name: 42, reason_for_consult: 'wrong type' },
        null,
        'a-string-not-object',
      ],
      reasoning: 'mixed',
    });
    const out = parseRoutingDecision(raw);
    expect(out.sub_agents).toEqual([{ name: 'nutrition', reason_for_consult: 'ok' }]);
  });

  it('defaults reason_for_consult to "" when missing or non-string', () => {
    const raw = JSON.stringify({
      sub_agents: [{ name: 'safety' }, { name: 'mental', reason_for_consult: 123 }],
    });
    const out = parseRoutingDecision(raw);
    expect(out.sub_agents).toEqual([
      { name: 'safety', reason_for_consult: '' },
      { name: 'mental', reason_for_consult: '' },
    ]);
  });

  it('passes through skip_sub_agents + direct_response', () => {
    const raw = JSON.stringify({
      sub_agents: [],
      reasoning: 'trivial greeting',
      skip_sub_agents: true,
      direct_response: 'Salut !',
    });
    const out = parseRoutingDecision(raw);
    expect(out.skip_sub_agents).toBe(true);
    expect(out.direct_response).toBe('Salut !');
  });

  it('coerces a truthy non-boolean skip_sub_agents to true', () => {
    const out = parseRoutingDecision(JSON.stringify({ sub_agents: [], skip_sub_agents: 1 }));
    expect(out.skip_sub_agents).toBe(true);
  });

  it('falls back to a safe skip decision when JSON is broken', () => {
    const out = parseRoutingDecision('not valid json {{{');
    expect(out.sub_agents).toEqual([]);
    expect(out.skip_sub_agents).toBe(true);
    expect(out.reasoning).toBe('parse_failed');
    expect(out.direct_response).toMatch(/reformuler/i);
  });

  it('also falls back when given an empty string', () => {
    const out = parseRoutingDecision('');
    expect(out.skip_sub_agents).toBe(true);
    expect(out.reasoning).toBe('parse_failed');
  });

  it('tolerates ```json fences (delegates to parseLLMJson)', () => {
    const raw = '```json\n' + JSON.stringify({ sub_agents: [{ name: 'analytics', reason_for_consult: 'trends' }] }) + '\n```';
    const out = parseRoutingDecision(raw);
    expect(out.sub_agents).toEqual([{ name: 'analytics', reason_for_consult: 'trends' }]);
  });
});

describe('supervisor — arbitrateOutputs', () => {
  it('returns undefined when no agent is critical', () => {
    const out = arbitrateOutputs({
      nutrition: makeOutput('nutrition', 'info'),
      training: makeOutput('training', 'warning'),
    });
    expect(out).toBeUndefined();
  });

  it('returns an empty object input as undefined', () => {
    expect(arbitrateOutputs({})).toBeUndefined();
  });

  it('overrides when SafetyCoach is critical', () => {
    const out = arbitrateOutputs({
      safety: makeOutput('safety', 'critical'),
      nutrition: makeOutput('nutrition', 'info'),
    });
    expect(out).toBeDefined();
    expect(out!.resolution).toMatch(/SafetyCoach/);
    expect(out!.disagreements).toEqual([]);
  });

  it('safety-critical takes precedence even when others are also critical', () => {
    const out = arbitrateOutputs({
      safety: makeOutput('safety', 'critical'),
      nutrition: makeOutput('nutrition', 'critical'),
    });
    expect(out!.resolution).toMatch(/SafetyCoach/);
    // The safety branch returns first, so disagreements stays empty.
    expect(out!.disagreements).toEqual([]);
  });

  it('records a disagreement when several non-safety agents are critical', () => {
    const out = arbitrateOutputs({
      nutrition: makeOutput('nutrition', 'critical'),
      training: makeOutput('training', 'critical'),
    });
    expect(out).toBeDefined();
    expect(out!.disagreements).toHaveLength(1);
    expect(out!.disagreements[0]).toMatch(/nutrition/);
    expect(out!.disagreements[0]).toMatch(/training/);
    expect(out!.resolution).toMatch(/escalade/i);
  });

  it('returns undefined when exactly one non-safety agent is critical', () => {
    const out = arbitrateOutputs({
      nutrition: makeOutput('nutrition', 'critical'),
      training: makeOutput('training', 'info'),
    });
    expect(out).toBeUndefined();
  });
});

describe('supervisor — garde-fou grossesse/allaitement', () => {
  it('détecte enceinte / grossesse / allaitement (insensible casse + accents partiels)', () => {
    expect(mentionsPregnancy('je suis enceinte de 4 mois')).toBe(true);
    expect(mentionsPregnancy('Grossesse: quel sport ?')).toBe(true);
    expect(mentionsPregnancy("j'allaite, je peux faire une sèche ?")).toBe(true);
    expect(mentionsPregnancy('post-partum reprise sport')).toBe(true);
    expect(mentionsPregnancy('je veux sécher pour cet été')).toBe(false);
    expect(mentionsPregnancy('plan de prise de masse')).toBe(false);
  });

  function decision(names: SubAgentName[], skip = false): RoutingDecision {
    return {
      sub_agents: names.map((name) => ({ name, reason_for_consult: 'x' })),
      reasoning: 'r',
      skip_sub_agents: skip,
    };
  }

  it('force safety quand grossesse mentionnée et safety absent', () => {
    const out = enforcePregnancySafety(decision(['nutrition']), 'je suis enceinte, un plan ?');
    expect(out.sub_agents.map((a) => a.name)).toContain('safety');
    expect(out.skip_sub_agents).toBe(false);
  });

  it('annule un skip_sub_agents si grossesse mentionnée', () => {
    const out = enforcePregnancySafety(decision([], true), 'enceinte');
    expect(out.skip_sub_agents).toBe(false);
    expect(out.sub_agents.map((a) => a.name)).toEqual(['safety']);
  });

  it('ne duplique pas safety s\'il est déjà routé', () => {
    const out = enforcePregnancySafety(decision(['safety', 'nutrition']), 'grossesse');
    expect(out.sub_agents.filter((a) => a.name === 'safety')).toHaveLength(1);
  });

  it('laisse la décision intacte si pas de grossesse', () => {
    const d = decision(['training']);
    const out = enforcePregnancySafety(d, 'plan de sèche');
    expect(out).toBe(d);
  });
});

describe('supervisor — buildAggregatePrompt (format réponse log factuel)', () => {
  const baseInput = { uid: 'u1', user_message: 'pr 130kg bench' };

  it('injecte la règle "log factuel = réponse courte" dans le prompt agrégateur', () => {
    const p = buildAggregatePrompt(baseInput, {}, undefined, null);
    expect(p).toContain('[FORMAT QUAND TU ÉMETS UNE COACH_ACTION POUR UN LOG FACTUEL]');
    expect(p).toContain('réponse doit être COURTE');
    expect(p).toContain('Au plus 1 phrase tactique');
  });

  it('interdit explicitement la liste de conseils et les mentions non sollicitées du profil', () => {
    const p = buildAggregatePrompt(baseInput, {}, undefined, null);
    expect(p).toContain('INTERDIT');
    expect(p).toContain('liste numérotée de conseils');
    // Le rappel doit nommer TRT comme exemple de mention de profil non sollicitée
    // (c'est l'incident qui a déclenché la règle).
    expect(p).toContain('TRT');
  });

  it("autorise une réponse normale si l'user POSE AUSSI une vraie question", () => {
    const p = buildAggregatePrompt(baseInput, {}, undefined, null);
    expect(p).toContain('Si l\'user POSE ÉGALEMENT une vraie question');
  });

  it('garde le contrat « honnêteté absolue » (régression : la concision ne le remplace pas)', () => {
    const p = buildAggregatePrompt(baseInput, {}, undefined, null);
    expect(p).toContain('HONNÊTETÉ ABSOLUE');
    expect(p).toContain('Ne prétends JAMAIS avoir fait ce que tu n\'as pas émis');
  });
});
