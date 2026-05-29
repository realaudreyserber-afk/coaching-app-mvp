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
import { buildCoachRagFragment, buildProfileForRag } from '@/lib/features/rag-coach/context';
import { getCycleSnapshot } from '@/lib/features/cycle/store';
import { getPrsSnapshot } from '@/lib/features/personal-records/store';
import { getSleepSnapshot } from '@/lib/features/sleep/store';
import { getHrvSnapshot } from '@/lib/features/hrv/store';
import { resolveProfileSnapshot } from '../profile-cache';
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
      const profile = await resolveProfileSnapshot(input);
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
      // Audit 2026-05-29 : mapping centralisé + typé (avant : { level, equipment }
      // via cast `as ProfileForRag` qui annulait le filtre niveau ET équipement).
      profileForRag = buildProfileForRag(profile);
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

    // Personal records — progression force (1RM, deltas 90j). La section
    // PERSONAL RECORDS du prompt en dépend ; l'import getPrsSnapshot était
    // présent mais jamais appelé (ctx.prs jamais peuplé) — audit 2026-05-29.
    try {
      const prs = await getPrsSnapshot(input.uid);
      if (prs) ctx.prs = prs;
    } catch (e) {
      console.warn('[training-agent] prs fetch failed:', e);
    }

    return ctx;
  }
}
