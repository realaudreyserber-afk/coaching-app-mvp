/**
 * SafetyCoach — sous-agent détection TCA / détresse / signaux critiques santé.
 *
 * **PRIORITÉ ABSOLUE** dans le système. Si severity=critical, le Supervisor
 * doit override les autres outputs.
 *
 * fetchContext :
 *  - profile.flags (antécédents TCA, comorbidités, mineur)
 *  - checkin_7day_history (énergie, humeur, sommeil, faim, poids)
 *  - alerts (collection users/{uid}/alerts existantes)
 *  - bloodwork récent si dispo
 *  - weight history 30 jours (détection perte non sollicitée)
 */

import 'server-only';
import { adminDb } from '@/lib/firebase/admin';
import { BaseAgent } from './base';
import { SAFETY_SYSTEM_PROMPT } from '../../prompts/agents/safety';
import { getHydrationSnapshot } from '@/lib/features/hydration/store';
import { getSubstancesSnapshot } from '@/lib/features/substances/store';
import { getLifeEventsSnapshot } from '@/lib/features/life-events/store';
import { getSleepSnapshot } from '@/lib/features/sleep/store';
import { getHrvSnapshot } from '@/lib/features/hrv/store';
import { resolveProfileSnapshot } from '../profile-cache';
import type { AgentInput, SubAgentName } from '../types';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export class SafetyCoach extends BaseAgent {
  readonly name: SubAgentName = 'safety';
  readonly systemPrompt = SAFETY_SYSTEM_PROMPT;
  readonly temperature = 0.1; // safety = tu veux du déterministe

  protected async fetchContext(input: AgentInput): Promise<Record<string, unknown>> {
    const ctx: Record<string, unknown> = {};
    const userRef = adminDb.collection('users').doc(input.uid);

    // Profile flags
    try {
      const profile = await resolveProfileSnapshot(input);
      ctx.profile_flags = {
        age: profile.age,
        is_minor: typeof profile.age === 'number' && profile.age < 18,
        sex: profile.sex,
        ed_history: profile.ed_history,
        comorbidities: profile.comorbidities,
        medications: profile.medications,
        // Audit 2026-05-29 : objectif + goals pour distinguer une perte de poids
        // SOLLICITÉE (cut volontaire) d'une perte NON sollicitée (drapeau TCA/maladie).
        objective: profile.objective,
        goals: profile.goals
          ? {
              target_weight: profile.goals.target_weight,
              duration_chosen_weeks: profile.goals.duration_chosen_weeks,
            }
          : null,
        // Statut hormonal EXPLICITE — la section HYDRATATION du prompt raisonne sur
        // "user sous TRT/GLP-1" ; sans ces champs la règle était morte OU déclenchée
        // sur inférence (risque TRT halluciné). Jamais inférer depuis medications.
        hormonal_context: profile.hormonal_context,
        uses_glp1: profile.uses_glp1,
      };
    } catch (e) {
      console.warn('[safety-agent] profile fetch failed:', e);
    }

    // Check-ins 7 jours (signaux énergie/humeur/sommeil/faim)
    try {
      const snap = await userRef
        .collection('checkins_daily')
        .orderBy('date', 'desc')
        .limit(7)
        .get();
      ctx.checkin_7day = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            date: data.date,
            weight: data.weight,
            energy: data.energy,
            mood: data.mood,
            sleep_hours: data.sleep_hours,
            hunger: data.hunger,
          };
        })
        .reverse();
    } catch (e) {
      console.warn('[safety-agent] checkins fetch failed:', e);
    }

    // Alerts existantes
    try {
      const snap = await userRef
        .collection('alerts')
        .orderBy('created_at', 'desc')
        .limit(5)
        .get();
      ctx.recent_alerts = snap.docs.map((d) => {
        const data = d.data();
        return {
          created_at: data.created_at,
          type: data.type,
          severity: data.severity,
          summary: data.summary ?? data.message,
        };
      });
    } catch (e) {
      console.warn('[safety-agent] alerts fetch failed:', e);
    }

    // Bloodwork récent
    try {
      const snap = await userRef
        .collection('bloodwork')
        .orderBy('date', 'desc')
        .limit(1)
        .get();
      const bw = snap.docs[0]?.data();
      if (bw) {
        ctx.bloodwork_recent = {
          date: bw.date,
          flags: bw.flags,
          note: bw.note,
        };
      }
    } catch (e) {
      console.warn('[safety-agent] bloodwork fetch failed:', e);
    }

    // Hydratation — alerte sous TRT/GLP-1 si insuffisant
    try {
      const hydration = await getHydrationSnapshot(input.uid);
      if (hydration) ctx.hydration = hydration;
    } catch (e) {
      console.warn('[safety-agent] hydration fetch failed:', e);
    }

    // Substances — détection patterns problématiques (binge alcool, nicotine pattern)
    try {
      const substances = await getSubstancesSnapshot(input.uid);
      if (substances) ctx.substances = substances;
    } catch (e) {
      console.warn('[safety-agent] substances fetch failed:', e);
    }

    // Life events — Phase 8 (deuil/rupture récents = vigilance dépression)
    try {
      const lifeEvents = await getLifeEventsSnapshot(input.uid);
      if (lifeEvents) ctx.life_events = lifeEvents;
    } catch (e) {
      console.warn('[safety-agent] life_events fetch failed:', e);
    }

    // Sleep + HRV — Phases 14+15 (signaux burnout/dépression)
    try {
      const sleep = await getSleepSnapshot(input.uid);
      if (sleep) ctx.sleep = sleep;
    } catch (e) {
      console.warn('[safety-agent] sleep fetch failed:', e);
    }
    try {
      const hrv = await getHrvSnapshot(input.uid);
      if (hrv) ctx.hrv = hrv;
    } catch (e) {
      console.warn('[safety-agent] hrv fetch failed:', e);
    }

    // Weight history 30j — détection perte rapide
    try {
      const thirtyAgoIso = new Date(Date.now() - THIRTY_DAYS_MS).toISOString().slice(0, 10);
      const snap = await userRef
        .collection('checkins_daily')
        .where('date', '>=', thirtyAgoIso)
        .orderBy('date', 'asc')
        .get();
      const weights = snap.docs
        .map((d) => ({ date: d.data().date, weight: d.data().weight }))
        .filter((w) => typeof w.weight === 'number');
      if (weights.length >= 2) {
        const first = weights[0].weight as number;
        const last = weights[weights.length - 1].weight as number;
        const deltaPct = ((last - first) / first) * 100;
        ctx.weight_trend_30day = {
          first_weight: first,
          last_weight: last,
          delta_pct: Math.round(deltaPct * 100) / 100,
          n_points: weights.length,
        };
      }
    } catch (e) {
      console.warn('[safety-agent] weight_trend fetch failed:', e);
    }

    return ctx;
  }
}
