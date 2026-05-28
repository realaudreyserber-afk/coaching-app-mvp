/**
 * TrainingCoach — sous-agent programmation/exos/biomécanique/récupération.
 *
 * fetchContext :
 *  - profile (level, equipment)
 *  - active_plan.training (split, fréquence)
 *  - workout_sessions (3 dernières)
 *  - form_checks (2 derniers)
 *  - rag exos via buildCoachRagFragment(query, profile)
 */

import 'server-only';
import { adminDb } from '@/lib/firebase/admin';
import { BaseAgent } from './base';
import { TRAINING_SYSTEM_PROMPT } from '../../prompts/agents/training';
import { buildCoachRagFragment } from '@/lib/features/rag-coach/context';
import { getCycleSnapshot } from '@/lib/features/cycle/store';
import { getPrsSnapshot } from '@/lib/features/personal-records/store';
import { getSleepSnapshot } from '@/lib/features/sleep/store';
import { getHrvSnapshot } from '@/lib/features/hrv/store';
import { getUserProfileSnapshot } from '@/lib/features/user-profile/snapshot';
import type { AgentInput, SubAgentName } from '../types';
import type { ProfileForRag } from '@/lib/features/rag-coach/context';

export class TrainingCoach extends BaseAgent {
  readonly name: SubAgentName = 'training';
  readonly systemPrompt = TRAINING_SYSTEM_PROMPT;
  readonly temperature = 0.3;

  protected async fetchContext(input: AgentInput): Promise<Record<string, unknown>> {
    const ctx: Record<string, unknown> = {};
    const userRef = adminDb.collection('users').doc(input.uid);

    // Profile subset utile pour training
    let profileForRag: ProfileForRag | undefined;
    let isFemale = false;
    try {
      const profile = await getUserProfileSnapshot(input.uid);
      ctx.profile = {
        objective: profile.objective,
        level: profile.training_level,
        equipment: profile.equipment,
        weight_kg: profile.weight_kg,
        age: profile.age,
        sex: profile.sex,
        injuries: profile.injuries,
        // Audit #4/#5 : section "Sous TRT" du prompt conditionnée à ce champ.
        hormonal_context: profile.hormonal_context,
      };
      profileForRag = {
        level: profile.training_level,
        equipment: profile.equipment,
      } as ProfileForRag;
      isFemale = profile.sex === 'female';
    } catch (e) {
      console.warn('[training-agent] profile fetch failed:', e);
    }

    // Cycle menstruel (si féminin) — phase = adapter recommandation intensité/volume
    if (isFemale) {
      try {
        const cycle = await getCycleSnapshot(input.uid);
        if (cycle) ctx.cycle = cycle;
      } catch (e) {
        console.warn('[training-agent] cycle fetch failed:', e);
      }
    }

    // active_plan.training
    try {
      const plans = await userRef
        .collection('plans')
        .where('active', '==', true)
        .limit(1)
        .get();
      const plan = plans.docs[0]?.data();
      if (plan?.training) {
        ctx.active_plan_training = {
          split: plan.training.split,
          frequency_per_week: plan.training.frequency_per_week,
          session_template: plan.training.session_template,
        };
      }
    } catch (e) {
      console.warn('[training-agent] active_plan fetch failed:', e);
    }

    // 3 dernières workout_sessions
    try {
      const snap = await userRef
        .collection('workout_sessions')
        .orderBy('date', 'desc')
        .limit(3)
        .get();
      ctx.recent_workouts = snap.docs.map((d) => {
        const data = d.data();
        return {
          date: data.date,
          type: data.type,
          exercises_count: Array.isArray(data.exercises) ? data.exercises.length : 0,
          rpe_avg: data.rpe_avg,
          duration_min: data.duration_min,
        };
      });
    } catch (e) {
      console.warn('[training-agent] workout_sessions fetch failed:', e);
    }

    // 2 derniers form_checks
    try {
      const snap = await userRef
        .collection('form_checks')
        .orderBy('analyzed_at', 'desc')
        .limit(2)
        .get();
      ctx.recent_form_checks = snap.docs.map((d) => {
        const data = d.data();
        return {
          analyzed_at: data.analyzed_at,
          exercise: data.exercise,
          feedback: data.analysis?.recommendations?.[0],
        };
      });
    } catch (e) {
      console.warn('[training-agent] form_checks fetch failed:', e);
    }

    // RAG exos pertinents pour le message
    try {
      const rag = await buildCoachRagFragment(input.user_message, profileForRag);
      if (rag) ctx.rag_exercises = rag;
    } catch (e) {
      console.warn('[training-agent] rag fetch failed:', e);
    }

    // Sleep — Phase 14 (récup)
    try {
      const sleep = await getSleepSnapshot(input.uid);
      if (sleep) ctx.sleep = sleep;
    } catch (e) {
      console.warn('[training-agent] sleep fetch failed:', e);
    }

    // HRV — Phase 15 (deload timing, fatigue cumulative)
    try {
      const hrv = await getHrvSnapshot(input.uid);
      if (hrv) ctx.hrv = hrv;
    } catch (e) {
      console.warn('[training-agent] hrv fetch failed:', e);
    }

    return ctx;
  }
}
