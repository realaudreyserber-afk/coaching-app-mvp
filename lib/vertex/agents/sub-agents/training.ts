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
import { searchExercises, type ExerciseLevel } from '@/lib/features/exercise-db';
import { matchFrExercise } from '@/lib/features/exercise-db/canonical';
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
        const exos = Array.isArray(data.exercises) ? data.exercises : [];
        return {
          date: data.date,
          type: data.type,
          rpe_avg: data.rpe_avg,
          duration_min: data.duration_min,
          // Audit 2026-05-29 : avant on ne gardait que exercises_count → l'agent
          // ne pouvait recommander aucune progression de charge. On expose
          // maintenant, par exo, le meilleur set (volume = poids × reps).
          exercises: exos.slice(0, 12).map((ex: Record<string, unknown>) => {
            const sets = Array.isArray(ex?.sets) ? (ex.sets as Array<Record<string, unknown>>) : [];
            let topSet: { weight_kg: number; reps_done: number } | undefined;
            for (const s of sets) {
              const w = typeof s?.weight_kg === 'number' ? s.weight_kg : undefined;
              const r = typeof s?.reps_done === 'number' ? s.reps_done : undefined;
              if (w !== undefined && r !== undefined) {
                if (!topSet || w * r > topSet.weight_kg * topSet.reps_done) {
                  topSet = { weight_kg: w, reps_done: r };
                }
              }
            }
            return {
              name: (ex?.name as string | undefined) ?? (ex?.exercise_id as string | undefined),
              sets_done: sets.length,
              top_set: topSet,
            };
          }),
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

    // Bibliothèque d'exercices (Functional Fitness v2.9) filtrée par NIVEAU +
    // équipement (+ muscle si mentionné dans le message) — pool concret,
    // niveau-approprié, complémentaire du RAG embeddings (audit/feature 2026-05-29).
    try {
      const lvlMap: Record<string, ExerciseLevel> = {
        beginner: 'debutant',
        intermediate: 'intermediaire',
        advanced: 'avance',
      };
      const maxLevel = lvlMap[String(profileForRag?.training_history ?? '').toLowerCase()] ?? 'intermediaire';
      const msg = input.user_message.toLowerCase();
      const MUSCLES: Record<string, string> = {
        fessier: 'fessiers', glute: 'fessiers', quadri: 'quadriceps', cuisse: 'quadriceps',
        jambe: 'quadriceps', dos: 'dos', pec: 'pectoraux', poitrine: 'pectoraux',
        epaule: 'epaules', biceps: 'biceps', triceps: 'triceps', abdo: 'abdominaux',
        gainage: 'abdominaux', ischio: 'ischio_jambiers', mollet: 'mollets',
      };
      const FAMILIES: Record<string, string> = {
        pousser: 'push', poussee: 'push', developpe: 'push', pompe: 'push',
        tirer: 'pull', tirage: 'pull', rowing: 'pull', traction: 'pull',
        squat: 'squat', fente: 'squat', souleve: 'hinge', charniere: 'hinge', hinge: 'hinge',
      };
      let muscle: string | undefined;
      for (const k of Object.keys(MUSCLES)) if (msg.includes(k)) { muscle = MUSCLES[k]; break; }
      let family: string | undefined;
      for (const k of Object.keys(FAMILIES)) if (msg.includes(k)) { family = FAMILIES[k]; break; }
      const opts = searchExercises(
        { maxLevel, family, equipment: profileForRag?.available_equipment, muscle },
        10,
      );
      if (opts.length > 0) {
        ctx.exercise_library = opts.map((e) => ({
          name_fr: e.name_fr,
          name: e.name,
          family: e.family,
          level: e.level,
          muscle: e.muscle,
          equipment: e.equipment,
          demo_url: e.demo_url,
        }));
      }
    } catch (e) {
      console.warn('[training-agent] exercise library fetch failed:', e);
    }

    // Si le message nomme un exercice mainstream (pompe, squat, développé couché…),
    // on le résout vers sa version PROPRE (pas une variante exotique de la base).
    try {
      const named = matchFrExercise(input.user_message);
      if (named) {
        ctx.named_exercise = {
          name_fr: named.name_fr,
          name: named.name,
          level: named.level,
          muscle: named.muscle,
          equipment: named.equipment,
          demo_url: named.demo_url,
        };
      }
    } catch (e) {
      console.warn('[training-agent] canonical match failed:', e);
    }

    return ctx;
  }
}
