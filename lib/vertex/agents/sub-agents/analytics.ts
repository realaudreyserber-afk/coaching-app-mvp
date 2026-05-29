/**
 * AnalyticsCoach — sous-agent diagnostic data (tendances, plateau, calibrage).
 *
 * fetchContext :
 *  - checkin_7day_history (énergie, humeur, sommeil, faim, poids)
 *  - tdee_history (estimations + actuel)
 *  - active_plan (kcal/macros cibles pour comparaison)
 *  - body_scan_recent (last)
 *  - recent_coach_patches (3 derniers)
 *  - food_logs_summary 7 derniers jours (cumul)
 */

import 'server-only';
import { adminDb } from '@/lib/firebase/admin';
import { BaseAgent } from './base';
import { ANALYTICS_SYSTEM_PROMPT } from '../../prompts/agents/analytics';
import { getMeasurementsSnapshot } from '@/lib/features/measurements/store';
import { getPrsSnapshot } from '@/lib/features/personal-records/store';
import { getHydrationSnapshot } from '@/lib/features/hydration/store';
import { getCravingsSnapshot } from '@/lib/features/cravings/store';
import { getProgressPhotosSnapshot } from '@/lib/features/progress-photos/store';
import { getHabitsSnapshot } from '@/lib/features/habits/store';
import { type NormalizedProfile } from '@/lib/features/user-profile/snapshot';
import { resolveProfileSnapshot } from '../profile-cache';
import { fetchScientificSources } from '../scientific-context';
import type { AgentInput, SubAgentName } from '../types';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export class AnalyticsCoach extends BaseAgent {
  readonly name: SubAgentName = 'analytics';
  readonly systemPrompt = ANALYTICS_SYSTEM_PROMPT;
  readonly temperature = 0.2;

  protected async fetchContext(input: AgentInput): Promise<Record<string, unknown>> {
    const ctx: Record<string, unknown> = {};
    const userRef = adminDb.collection('users').doc(input.uid);
    const nowIso = new Date().toISOString();
    const sevenDaysAgoIso = new Date(Date.now() - SEVEN_DAYS_MS).toISOString();

    let profile: NormalizedProfile | null = null;
    try {
      profile = await resolveProfileSnapshot(input);
    } catch (e) {
      console.warn('[analytics-agent] profile fetch failed:', e);
    }

    // checkin_7day_history
    try {
      const snap = await userRef
        .collection('checkins_daily')
        .orderBy('date', 'desc')
        .limit(7)
        .get();
      ctx.checkin_7day_history = snap.docs
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
      console.warn('[analytics-agent] checkins fetch failed:', e);
    }

    // tdee_history (5 derniers points)
    try {
      const snap = await userRef
        .collection('tdee_history')
        .orderBy('estimated_at', 'desc')
        .limit(5)
        .get();
      ctx.tdee_history = snap.docs.map((d) => {
        const data = d.data();
        return {
          estimated_at: data.estimated_at,
          tdee_kcal: data.tdee_kcal,
          method: data.method,
        };
      });
    } catch (e) {
      console.warn('[analytics-agent] tdee_history fetch failed:', e);
    }

    // active_plan (cibles)
    try {
      const plans = await userRef
        .collection('plans')
        .where('active', '==', true)
        .limit(1)
        .get();
      const plan = plans.docs[0]?.data();
      if (plan) {
        ctx.active_plan_targets = {
          kcal: plan.kcal,
          macros: plan.macros,
          date_start: plan.date_start,
        };
      }
    } catch (e) {
      console.warn('[analytics-agent] active_plan fetch failed:', e);
    }

    // Goals avec durée recommandée — pour évaluer si l'user tient le rythme
    // prévu (delta_kg_per_week observé vs delta cible attendu par duration_chosen)
    if (profile?.goals) {
      ctx.goals = {
        type: profile.goals.type,
        target_weight: profile.goals.target_weight,
        target_date: profile.goals.target_date,
        duration_chosen_weeks: profile.goals.duration_chosen_weeks,
        recommended_weeks_min: profile.goals.recommended_weeks_min,
        recommended_weeks_max: profile.goals.recommended_weeks_max,
      };
    }

    // body_scan_recent (last)
    try {
      const snap = await userRef
        .collection('body_scans')
        .orderBy('created_at', 'desc')
        .limit(1)
        .get();
      const scan = snap.docs[0]?.data();
      if (scan) {
        ctx.body_scan_recent = {
          created_at: scan.created_at,
          weight_kg: scan.weight_kg,
          bf_pct_estimated: scan.bf_pct_estimated,
          notes: scan.notes,
        };
      }
    } catch (e) {
      console.warn('[analytics-agent] body_scan fetch failed:', e);
    }

    // recent_coach_patches (3 derniers)
    try {
      const snap = await userRef
        .collection('coach_patches')
        .orderBy('patched_at', 'desc')
        .limit(3)
        .get();
      ctx.recent_coach_patches = snap.docs.map((d) => {
        const data = d.data();
        return {
          patched_at: data.patched_at,
          summary: data.summary ?? data.reason,
          field: data.field,
        };
      });
    } catch (e) {
      console.warn('[analytics-agent] coach_patches fetch failed:', e);
    }

    // Mensurations évolutives (tendances 30j / 90j)
    try {
      const measurements = await getMeasurementsSnapshot(input.uid);
      if (measurements) ctx.measurements = measurements;
    } catch (e) {
      console.warn('[analytics-agent] measurements fetch failed:', e);
    }

    // Personal Records — progression force
    try {
      const prs = await getPrsSnapshot(input.uid);
      if (prs) ctx.prs = prs;
    } catch (e) {
      console.warn('[analytics-agent] prs fetch failed:', e);
    }

    // Hydratation — corrélation possible avec poids matin
    try {
      const hydration = await getHydrationSnapshot(input.uid);
      if (hydration) ctx.hydration = hydration;
    } catch (e) {
      console.warn('[analytics-agent] hydration fetch failed:', e);
    }

    // Cravings patterns
    try {
      const cravings = await getCravingsSnapshot(input.uid);
      if (cravings) ctx.cravings = cravings;
    } catch (e) {
      console.warn('[analytics-agent] cravings fetch failed:', e);
    }

    // Photos progression — Phase 7 (snapshot count + suggestion refaire)
    try {
      const photos = await getProgressPhotosSnapshot(input.uid);
      if (photos) ctx.progress_photos = photos;
    } catch (e) {
      console.warn('[analytics-agent] progress_photos fetch failed:', e);
    }

    // Habits — Phase 11 (adherence corrélée à composition)
    try {
      const habits = await getHabitsSnapshot(input.uid);
      if (habits) ctx.habits = habits;
    } catch (e) {
      console.warn('[analytics-agent] habits fetch failed:', e);
    }

    // food_logs_summary 7 derniers jours (cumul jour par jour)
    try {
      const snap = await userRef
        .collection('food_logs')
        .where('logged_at', '>=', sevenDaysAgoIso)
        .where('logged_at', '<', nowIso)
        .get();
      const byDay: Record<string, { kcal: number; count: number }> = {};
      snap.docs.forEach((d) => {
        const data = d.data();
        const day = (data.logged_at as string | undefined)?.slice(0, 10);
        if (!day) return;
        if (!byDay[day]) byDay[day] = { kcal: 0, count: 0 };
        byDay[day].kcal += data.totals?.kcal ?? 0;
        byDay[day].count += 1;
      });
      ctx.food_logs_7day_summary = Object.entries(byDay)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([date, v]) => ({ date, kcal: v.kcal, entries: v.count }));
    } catch (e) {
      console.warn('[analytics-agent] food_logs summary fetch failed:', e);
    }

    // Sources scientifiques réelles pour grounder les citations (anti-
    // hallucination) — le prompt impose de ne citer QUE depuis ce tableau.
    const sci = await fetchScientificSources(input.user_message);
    if (sci.length > 0) ctx.scientific_sources = sci;

    return ctx;
  }
}
