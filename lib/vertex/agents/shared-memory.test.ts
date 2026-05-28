import { describe, it, expect, vi } from 'vitest';

// shared-memory.ts imports `server-only` (throws under vitest), the firebase
// admin proxy, and firebase-admin/firestore. Stub them so we can import the
// pure helpers (estimateCostUsd, stripUndefined, createEmptySharedMemory).
vi.mock('server-only', () => ({}));
vi.mock('@/lib/firebase/admin', () => ({ adminDb: {} }));
vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: () => 'ts' },
}));

import { estimateCostUsd, stripUndefined } from './shared-memory';
// createEmptySharedMemory lives in ./types (shared-memory builds on it); imported
// from its real home — the source is not modified to re-export it.
import { createEmptySharedMemory } from './types';

describe('shared-memory — estimateCostUsd', () => {
  it('returns 0 for zero tokens', () => {
    expect(estimateCostUsd(0, 0)).toBe(0);
  });

  it('prices input at $1.50/M and output at $9.00/M', () => {
    // 1M input = $1.50, 1M output = $9.00 → total $10.50
    expect(estimateCostUsd(1_000_000, 1_000_000)).toBe(10.5);
  });

  it('prices input-only correctly', () => {
    expect(estimateCostUsd(2_000_000, 0)).toBe(3);
  });

  it('prices output-only correctly', () => {
    expect(estimateCostUsd(0, 500_000)).toBe(4.5);
  });

  it('rounds to 5 decimal places', () => {
    // 1000 input tokens = 1000/1e6 * 1.5 = 0.0015 exactly
    expect(estimateCostUsd(1000, 0)).toBe(0.0015);
    // A value that needs rounding: 1 output token = 9/1e6 = 0.000009 → rounds to 0.00001
    expect(estimateCostUsd(0, 1)).toBe(0.00001);
  });
});

describe('shared-memory — stripUndefined', () => {
  it('removes undefined keys from a flat object', () => {
    expect(stripUndefined({ a: 1, b: undefined, c: 'x' })).toEqual({ a: 1, c: 'x' });
  });

  it('preserves null values (only undefined is stripped)', () => {
    expect(stripUndefined({ a: null, b: undefined })).toEqual({ a: null });
  });

  it('recurses into nested objects', () => {
    expect(
      stripUndefined({ outer: { keep: 1, drop: undefined }, top: undefined }),
    ).toEqual({ outer: { keep: 1 } });
  });

  it('filters undefined entries out of arrays and recurses into elements', () => {
    expect(
      stripUndefined([1, undefined, { a: 2, b: undefined }]),
    ).toEqual([1, { a: 2 }]);
  });

  it('returns primitives untouched', () => {
    expect(stripUndefined(42)).toBe(42);
    expect(stripUndefined('s')).toBe('s');
    expect(stripUndefined(null)).toBe(null);
    expect(stripUndefined(undefined)).toBe(undefined);
  });

  it('handles a deeply nested mix end to end', () => {
    const input = {
      session_id: 's1',
      arbitration: undefined,
      facts: { weight: 80, note: undefined, nested: { ok: true, gone: undefined } },
      list: [{ x: 1, y: undefined }, undefined],
    };
    expect(stripUndefined(input)).toEqual({
      session_id: 's1',
      facts: { weight: 80, nested: { ok: true } },
      list: [{ x: 1 }],
    });
  });
});

describe('shared-memory — createEmptySharedMemory (re-export sanity)', () => {
  it('produces an empty shared memory shell', () => {
    const mem = createEmptySharedMemory();
    expect(mem.facts).toEqual({});
    expect(mem.decisions).toEqual([]);
    expect(mem.notes.safety).toEqual([]);
  });
});
