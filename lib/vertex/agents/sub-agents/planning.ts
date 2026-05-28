/**
 * PlanningCoach — sous-agent planification long-terme (bulk/cut/mini-cut/diet break/reverse/recomp).
 *
 * fetchContext :
 *  - profile (objectif, niveau, ancienneté training)
 *  - active_plan (phase actuelle si déclarée)
 *  - weight_history_60day (tendance long terme — 60 jours via checkins_daily)
 *  - plans_history (historique des phases passées)
 *  - tdee_history (drift métabolique)
 *  - checkin_summary (moyennes énergie/libido/sommeil sur 30j)
 */

import 'server-only';
import { adminDb } from '@/lib/firebase/admin';
import { BaseAgent } from './base';
import { PLANNING_SYSTEM_PROMPT } from '../../prompts/agents/planning';
import { getCycleSnapshot } from '@/lib/features/cycle/store';
import { getMeasurementsSnapshot } from '@/lib/features/measurements/store';
import type { AgentInput, SubAgentName } from '../types';

const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export class PlanningCoach extends BaseAgent {
  readonly name: SubAgentName = 'planning';
  readonly systemPrompt = PLANNING_SYSTEM_PROMPT;
  readonly temperature = 0.2;

  protected async fetchContext(input: AgentInput): Promise<Record<string, unknown>> {
    const ctx: Record<string, unknown> = {};
    const userRef = adminDb.collection('users').doc(input.uid);

    // Profile (subset stratégique)
    let isFemale = false;
    try {
      const snap = await userRef.get();
      const profile = snap.data();
      if (profile) {
        ctx.profile = {
          objective: profile.objective,
          training_seniority_years: profile.training_seniority_years ?? profile.training_history,
          weight_kg: profile.weight_kg,
          target_weight_kg: profile.target_weight_kg,
          sex: profile.sex,
          age: profile.age,
          activity_level: profile.activity_level,
          competition_target_date: profile.competition_target_date,
        };
        isFemale = profile.sex === 'female';
      }
    } catch (e) {
      console.warn('[planning-agent] profile fetch failed:', e);
    }

    // Cycle menstruel (si féminin) — éviter diet break en pré-règles, adapter cut long
    if (isFemale) {
      try {
        const cycle = await getCycleSnapshot(input.uid);
        if (cycle) ctx.cycle = cycle;
      } catch (e) {
        console.warn('[planning-agent] cycle fetch failed:', e);
      }
    }

    // active_plan + phase déclarée
    try {
      const plans = await userRef
        .collection('plans')
        .where('active', '==', true)
        .limit(1)
        .get();
      const plan = plans.docs[0]?.data();
      if (plan) {
        ctx.active_plan = {
          kcal: plan.kcal,
          macros: plan.macros,
          phase: plan.phase,
          date_start: plan.date_start,
          weeks_active: plan.date_start
            ? Math.floor(
                (Date.now() - new Date(plan.date_start).getTime()) / (7 * 24 * 60 * 60 * 1000),
              )
            : undefined,
        };
      }
    } catch (e) {
      console.warn('[planning-agent] active_plan fetch failed:', e);
    }

    // weight_history_60day (via checkins_daily)
    try {
      const sixtyAgoIso = new Date(Date.now() - SIXTY_DAYS_MS).toISOString().slice(0, 10);
      const snap = await userRef
        .collection('checkins_daily')
        .where('date', '>=', sixtyAgoIso)
        .orderBy('date', 'asc')
        .get();
      const weights = snap.docs
        .map((d) => ({ date: d.data().date as string, weight: d.data().weight_kg as number }))
        .filter((w) => typeof w.weight === 'number');
      if (weights.length >= 4) {
        const first = weights[0];
        const last = weights[weights.length - 1];
        const deltaKg = last.weight - first.weight;
        const deltaDays =
          (new Date(last.date).getTime() - new Date(first.date).getTime()) / (24 * 60 * 60 * 1000);
        const kgPerWeek = deltaDays > 0 ? (deltaKg / deltaDays) * 7 : 0;
        ctx.weight_trend_60day = {
          first: first.weight,
          last: last.weight,
          delta_kg: Math.round(deltaKg * 100) / 100,
          kg_per_week: Math.round(kgPerWeek * 100) / 100,
          n_points: weights.length,
        };
      }
    } catch (e) {
      console.warn('[planning-agent] weight_history fetch failed:', e);
    }

    // plans_history — combien de phases, durée, dernières orientations
    try {
      const snap = await userRef
        .collection('plans_history')
        .orderBy('date', 'desc')
        .limit(5)
        .get();
      if (snap.size > 0) {
        ctx.recent_plans = snap.docs.map((d) => {
          const data = d.data();
          return {
            date: data.date,
            phase: data.phase,
            kcal: data.kcal,
            duration_weeks: data.duration_weeks,
            reason_change: data.reason_change,
          };
        });
      }
    } catch (e) {
      console.warn('[planning-agent] plans_history fetch failed:', e);
    }

    // tdee_history — drift métabolique
    try {
      const snap = await userRef
        .collection('tdee_history')
        .orderBy('estimated_at', 'desc')
        .limit(6)
        .get();
      if (snap.size > 0) {
        ctx.tdee_history = snap.docs.map((d) => {
          const data = d.data();
          return {
            estimated_at: data.estimated_at,
            tdee_kcal: data.tdee_kcal,
          };
        });
      }
    } catch (e) {
      console.warn('[planning-agent] tdee_history fetch failed:', e);
    }

    // Mensurations long-terme (delta 30j / 90j par mesure)
    try {
      const measurements = await getMeasurementsSnapshot(input.uid);
      if (measurements) ctx.measurements = measurements;
    } catch (e) {
      console.warn('[planning-agent] measurements fetch failed:', e);
    }

    // checkin_summary — moyennes énergie/libido/sommeil 30 jours
    try {
      const thirtyAgoIso = new Date(Date.now() - THIRTY_DAYS_MS).toISOString().slice(0, 10);
      const snap = await userRef
        .collection('checkins_daily')
        .where('date', '>=', thirtyAgoIso)
        .orderBy('date', 'asc')
        .get();
      const checkins = snap.docs.map((d) => d.data());
      if (checkins.length >= 5) {
        const avg = (key: string) => {
          const values = checkins.map((c) => c[key]).filter((v) => typeof v === 'number');
          return values.length > 0
            ? Math.round((values.reduce((s, v) => s + (v as number), 0) / values.length) * 10) / 10
            : null;
        };
        ctx.checkin_summary_30day = {
          n_checkins: checkins.length,
          avg_energy: avg('energy'),
          avg_mood: avg('mood'),
          avg_sleep_h: avg('sleep_h'),
          avg_hunger: avg('hunger'),
        };
      }
    } catch (e) {
      console.warn('[planning-agent] checkin_summary fetch failed:', e);
    }

    return ctx;
  }
}
