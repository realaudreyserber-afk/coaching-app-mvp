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
      const snap = await userRef.get();
      const profile = snap.data();
      if (profile) {
        ctx.profile_flags = {
          age: profile.age,
          is_minor: typeof profile.age === 'number' && profile.age < 18,
          sex: profile.sex,
          ed_history: profile.ed_history ?? profile.tca_history ?? false,
          comorbidities: profile.comorbidities,
          medications: profile.medications,
        };
      }
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
            weight_kg: data.weight_kg,
            energy: data.energy,
            mood: data.mood,
            sleep_h: data.sleep_h,
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

    // Weight history 30j — détection perte rapide
    try {
      const thirtyAgoIso = new Date(Date.now() - THIRTY_DAYS_MS).toISOString().slice(0, 10);
      const snap = await userRef
        .collection('checkins_daily')
        .where('date', '>=', thirtyAgoIso)
        .orderBy('date', 'asc')
        .get();
      const weights = snap.docs
        .map((d) => ({ date: d.data().date, weight: d.data().weight_kg }))
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
