import { describe, it, expect } from 'vitest';
import { buildEnrichedSystemPrompt, buildUserContext, type UserContext } from './context-builder';

const BASE = 'Tu es un coach IA.';

describe('context-builder — profile block', () => {
  it('renders profile when available', () => {
    const ctx: UserContext = {
      profile: { name: 'Audrey', weight: 132.5, tdee_adaptive: 2480 },
      goals: { target_weight: 115, primary_goal: 'lose_weight' },
    };
    const out = buildEnrichedSystemPrompt(BASE, ctx);
    expect(out).toContain('Audrey');
    expect(out).toContain('132.5');
    expect(out).toContain('115');
    expect(out).toContain('2480');
  });

  it('omits profile block when nothing is passed', () => {
    const out = buildEnrichedSystemPrompt(BASE, {});
    expect(out).toContain(BASE);
    expect(out).not.toContain('PROFIL DE');
  });
});

describe('context-builder — GLP-1 block', () => {
  it('only appears when glp1.active is true', () => {
    const ctxOn = buildEnrichedSystemPrompt(BASE, {
      glp1: { active: true, molecule: 'semaglutide', dose: '1mg' },
    });
    expect(ctxOn).toContain('TRAITEMENT GLP-1');
    expect(ctxOn).toContain('SEMAGLUTIDE');
    expect(ctxOn).toContain('2.0-2.2g/kg');

    const ctxOff = buildEnrichedSystemPrompt(BASE, {
      glp1: { active: false, molecule: 'semaglutide' },
    });
    expect(ctxOff).not.toContain('TRAITEMENT GLP-1');
  });
});

describe('context-builder — fasting block', () => {
  it('appears only when active', () => {
    const out = buildEnrichedSystemPrompt(BASE, {
      fasting: { active: true, type: '16:8', eating_window_start: '12h', eating_window_end: '20h' },
    });
    expect(out).toContain('JEÛNE INTERMITTENT');
    expect(out).toContain('16:8');
    expect(out).toContain('12h');
  });
});

describe('context-builder — RAG block', () => {
  it('cites sources with the strict no-invent rule', () => {
    const out = buildEnrichedSystemPrompt(BASE, {
      rag_sources: [
        {
          title: 'Protein intake & muscle preservation',
          authors: 'Helms et al.',
          source: 'JISSN',
          year: '2022',
          url: 'https://example.com/1',
        },
      ],
    });
    expect(out).toContain('Helms et al.');
    expect(out).toContain('Source #1');
    expect(out).toContain('N\'invente AUCUNE source');
  });

  it('omits RAG block when no sources', () => {
    const out = buildEnrichedSystemPrompt(BASE, { rag_sources: [] });
    expect(out).not.toContain('SOURCES SCIENTIFIQUES');
  });
});

describe('context-builder — bloodwork block', () => {
  it('renders markers with reference ranges + statuses', () => {
    const out = buildEnrichedSystemPrompt(BASE, {
      bloodwork: {
        date: '2026-04-15',
        summary: 'Profil lipidique amélioré',
        markers: [
          { name: 'LDL', value: 1.42, unit: 'g/L', reference_range: '< 1.6', status: 'normal' },
          { name: 'Ferritine', value: 18, unit: 'µg/L', reference_range: '20-200', status: 'low' },
        ],
      },
    });
    expect(out).toContain('BILAN SANGUIN');
    expect(out).toContain('LDL');
    expect(out).toContain('Ferritine');
    expect(out).toContain('Ne pose JAMAIS de diagnostic');
  });
});

describe('context-builder — opt-in blocks', () => {
  it('respects opt-out flags', () => {
    const out = buildEnrichedSystemPrompt(
      BASE,
      {
        profile: { name: 'X' },
        glp1: { active: true, molecule: 'tirzepatide' },
      },
      { includeProfile: false, includeGlp1: false }
    );
    expect(out).not.toContain('PROFIL DE');
    expect(out).not.toContain('TRAITEMENT GLP-1');
  });

  it('notification block opt-in only', () => {
    const ctx = { notification_context: { has_checkin_today: false, hour_local: 20 } };
    const off = buildEnrichedSystemPrompt(BASE, ctx);
    expect(off).not.toContain('CONTEXTE NOTIFICATION');

    const on = buildEnrichedSystemPrompt(BASE, ctx, { includeNotification: true });
    expect(on).toContain('CONTEXTE NOTIFICATION');
    expect(on).toContain('PAS fait son check-in');
  });
});

describe('context-builder — buildUserContext (ADR-006 schema mapping)', () => {
  it('maps glp1 from medical.glp1 nested map (post-migration)', () => {
    const ctx = buildUserContext({
      userData: { medical: { glp1: { active: true, molecule: 'tirzepatide' } } },
    });
    expect(ctx.glp1?.active).toBe(true);
    expect(ctx.glp1?.molecule).toBe('tirzepatide');
  });

  it('maps fasting_protocol from user root map', () => {
    const ctx = buildUserContext({
      userData: { fasting_protocol: { active: true, type: '18:6' } },
    });
    expect(ctx.fasting?.type).toBe('18:6');
  });

  it('maps active_plan from injected plan doc', () => {
    const ctx = buildUserContext({
      userData: {},
      activePlan: { kcal: 2400, macros: { p: 180, c: 230, f: 70 } },
    });
    expect(ctx.active_plan?.kcal).toBe(2400);
    expect(ctx.active_plan?.macros?.p).toBe(180);
  });
});
