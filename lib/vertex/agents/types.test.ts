import { describe, it, expect } from 'vitest';
import {
  isValidSubAgentName,
  createEmptySharedMemory,
  SUB_AGENT_NAMES,
} from './types';

describe('types — isValidSubAgentName', () => {
  it('accepts the 8 canonical sub-agent names', () => {
    const valid = [
      'nutrition',
      'training',
      'analytics',
      'safety',
      'mental',
      'social',
      'education',
      'planning',
    ];
    expect(valid).toHaveLength(8);
    for (const name of valid) {
      expect(isValidSubAgentName(name)).toBe(true);
    }
  });

  it('stays in sync with the runtime SUB_AGENT_NAMES source of truth', () => {
    expect(SUB_AGENT_NAMES).toHaveLength(8);
    for (const name of SUB_AGENT_NAMES) {
      expect(isValidSubAgentName(name)).toBe(true);
    }
  });

  it('rejects unknown names', () => {
    expect(isValidSubAgentName('Nutrition')).toBe(false); // case-sensitive
    expect(isValidSubAgentName('supervisor')).toBe(false);
    expect(isValidSubAgentName('coach')).toBe(false);
    expect(isValidSubAgentName('')).toBe(false);
    expect(isValidSubAgentName(' nutrition')).toBe(false);
  });

  it('rejects non-string inputs without throwing', () => {
    expect(isValidSubAgentName(null)).toBe(false);
    expect(isValidSubAgentName(undefined)).toBe(false);
    expect(isValidSubAgentName(42)).toBe(false);
    expect(isValidSubAgentName({ name: 'nutrition' })).toBe(false);
    expect(isValidSubAgentName(['nutrition'])).toBe(false);
  });
});

describe('types — createEmptySharedMemory', () => {
  it('initializes one empty note array per sub-agent', () => {
    const mem = createEmptySharedMemory();
    for (const name of SUB_AGENT_NAMES) {
      expect(mem.notes[name]).toEqual([]);
    }
    expect(Object.keys(mem.notes).sort()).toEqual([...SUB_AGENT_NAMES].sort());
  });

  it('initializes empty facts map and decisions array', () => {
    const mem = createEmptySharedMemory();
    expect(mem.facts).toEqual({});
    expect(mem.decisions).toEqual([]);
  });

  it('returns a fresh object each call (no shared mutable state)', () => {
    const a = createEmptySharedMemory();
    const b = createEmptySharedMemory();
    a.notes.nutrition.push('note');
    a.facts.weight = 80;
    a.decisions.push('decided');
    expect(b.notes.nutrition).toEqual([]);
    expect(b.facts).toEqual({});
    expect(b.decisions).toEqual([]);
  });
});
