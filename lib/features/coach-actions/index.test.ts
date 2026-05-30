import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => {
  const state: { lastSet: any; lastDoc: string | null } = { lastSet: null, lastDoc: null };
  const chain: any = {};
  chain.collection = () => chain;
  chain.doc = (id?: string) => { if (id) state.lastDoc = id; return chain; };
  chain.set = (payload: any) => { state.lastSet = payload; return Promise.resolve(); };
  return { state, chain };
});
vi.mock('server-only', () => ({}));
vi.mock('@/lib/firebase/admin', () => ({ adminDb: h.chain }));
vi.mock('firebase-admin/firestore', () => ({ FieldValue: { serverTimestamp: () => 'TS' } }));

import { parseCoachActions, applyCoachAction } from './index';

beforeEach(() => { h.state.lastSet = null; h.state.lastDoc = null; });

describe('coach-actions / parseCoachActions', () => {
  it('extrait un bloc + nettoie le texte affiché', () => {
    const txt = 'C\'est noté !\n<COACH_ACTION>{"type":"log_weight","weight_kg":82,"date":"2026-05-30"}</COACH_ACTION>';
    const { actions, cleaned } = parseCoachActions(txt);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({ type: 'log_weight', weight_kg: 82 });
    expect(cleaned).toBe("C'est noté !");
    expect(cleaned).not.toContain('COACH_ACTION');
  });

  it('tolère un tableau d\'actions', () => {
    const { actions } = parseCoachActions('<COACH_ACTION>[{"type":"log_weight","weight_kg":80},{"type":"log_weight","weight_kg":81}]</COACH_ACTION>');
    expect(actions).toHaveLength(2);
  });

  it('ignore un bloc JSON malformé (pas de crash)', () => {
    const { actions, cleaned } = parseCoachActions('Texte <COACH_ACTION>{pas du json}</COACH_ACTION> fin');
    expect(actions).toHaveLength(0);
    expect(cleaned).not.toContain('COACH_ACTION');
  });

  it('aucune action -> texte intact', () => {
    expect(parseCoachActions('Bonjour').actions).toHaveLength(0);
  });
});

describe('coach-actions / applyCoachAction', () => {
  const TODAY = '2026-05-30';

  it('enregistre une pesée valide (merge dans checkins_daily)', async () => {
    const r = await applyCoachAction('uid1', { type: 'log_weight', weight_kg: 142, date: '2026-04-01' }, TODAY);
    expect(r.ok).toBe(true);
    expect(h.state.lastDoc).toBe('2026-04-01');
    expect(h.state.lastSet).toMatchObject({ weight: 142, date: '2026-04-01', source: 'coach' });
    expect(h.state.lastSet.created_at).toContain('2026-04-01');
  });

  it('défaut = aujourd\'hui si pas de date', async () => {
    const r = await applyCoachAction('uid1', { type: 'log_weight', weight_kg: 80 }, TODAY);
    expect(r.ok).toBe(true);
    expect(h.state.lastDoc).toBe(TODAY);
  });

  it('refuse un poids hors bornes (rien écrit)', async () => {
    const r = await applyCoachAction('uid1', { type: 'log_weight', weight_kg: 5 }, TODAY);
    expect(r.ok).toBe(false);
    expect(h.state.lastSet).toBeNull();
  });

  it('clamp une date future à aujourd\'hui', async () => {
    await applyCoachAction('uid1', { type: 'log_weight', weight_kg: 80, date: '2099-01-01' }, TODAY);
    expect(h.state.lastDoc).toBe(TODAY);
  });

  it('refuse une action non supportée', async () => {
    const r = await applyCoachAction('uid1', { type: 'delete_everything' }, TODAY);
    expect(r.ok).toBe(false);
    expect(h.state.lastSet).toBeNull();
  });
});
