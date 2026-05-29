/**
 * NutritionCoach — sous-agent macros/aliments/recettes/fasting/GLP-1.
 *
 * fetchContext :
 *  - profile (objectif, poids, genre)
 *  - active_plan (kcal/macros/meals_template subset)
 *  - today_food_logs (totaux + sample d'aliments)
 *  - top 3 nutrition_guides Ottawa pertinents par rapport au message user
 */

import 'server-only';
import { adminDb } from '@/lib/firebase/admin';
import { BaseAgent } from './base';
import { NUTRITION_SYSTEM_PROMPT } from '../../prompts/agents/nutrition';
import { searchNutritionGuides, getProtocolForUser } from '@/lib/features/rag-sourcing/internal-corpus';
import { getCycleSnapshot } from '@/lib/features/cycle/store';
import { getHydrationSnapshot } from '@/lib/features/hydration/store';
import { getSubstancesSnapshot } from '@/lib/features/substances/store';
import { getCravingsSnapshot } from '@/lib/features/cravings/store';
import { getFastingState } from '@/lib/features/fasting/fasting-util';
import { resolveProfileSnapshot } from '../profile-cache';
import { fetchScientificSources } from '../scientific-context';
import { analyzeMicronutrientIntake } from '@/lib/features/micronutrients/intake-analysis';
import type { AgentInput, SubAgentName } from '../types';

export class NutritionCoach extends BaseAgent {
  readonly name: SubAgentName = 'nutrition';
  readonly systemPrompt = NUTRITION_SYSTEM_PROMPT;
  readonly temperature = 0.3;

  protected async fetchContext(input: AgentInput): Promise<Record<string, unknown>> {
    const ctx: Record<string, unknown> = {};
    const userRef = adminDb.collection('users').doc(input.uid);

    // Profile (subset utile pour nutrition)
    let isFemale = false;
    let profile: any = null;
    try {
      profile = await resolveProfileSnapshot(input);
      ctx.profile = {
        objective: profile.objective,
        weight_kg: profile.weight_kg,
        height_cm: profile.height_cm,
        age: profile.age,
        sex: profile.sex,
        activity_level: profile.activity_level,
        dietary_restrictions: profile.dietary_restrictions,
        dietary_preferences: profile.dietary_preferences, // Phase 9
        allergies: profile.allergies, // Phase 9
        dislikes: profile.dislikes, // Phase 9
        uses_glp1: profile.uses_glp1,
        // Audit #4/#5 : contexte hormonal explicite — la section "Sous TRT"
        // du prompt ne s'active QUE sur ce champ (jamais d'inférence sexe/poids).
        hormonal_context: profile.hormonal_context,
        // Antécédent TCA déclaré : abaisse le seuil de vigilance (audit 2026-05-29).
        ed_history: profile.ed_history,
      };
      isFemale = profile.sex === 'female';
    } catch (e) {
      console.warn('[nutrition-agent] profile fetch failed:', e);
    }

    // Cycle menstruel (uniquement si féminin) — adapter macros + cravings selon phase
    if (isFemale) {
      try {
        const cycle = await getCycleSnapshot(input.uid);
        if (cycle) ctx.cycle = cycle;
      } catch (e) {
        console.warn('[nutrition-agent] cycle fetch failed:', e);
      }
    }

    // Active plan (kcal + macros + meals_template subset)
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
          meals_template: Array.isArray(plan.meals_template)
            ? plan.meals_template.map((m: { name?: string; approx_kcal?: number }) => ({
                name: m?.name,
                approx_kcal: m?.approx_kcal,
              }))
            : undefined,
        };
      }
    } catch (e) {
      console.warn('[nutrition-agent] active_plan fetch failed:', e);
    }

    // Goals avec durée recommandée — pour calibrer la sévérité du déficit
    // selon le timeline que l'user a choisi
    if (profile?.goals) {
      ctx.goals = {
        type: profile.goals.type,
        target_weight: profile.goals.target_weight,
        duration_chosen_weeks: profile.goals.duration_chosen_weeks,
        recommended_weeks_min: profile.goals.recommended_weeks_min,
      };
    }

    // Today's food logs (totaux du jour + 5 dernières entries)
    try {
      const todayYmd = new Date().toISOString().split('T')[0];
      const logs = await userRef
        .collection('food_logs')
        .where('logged_at', '>=', `${todayYmd}T00:00:00`)
        .orderBy('logged_at', 'desc')
        .limit(20)
        .get();
      let totalKcal = 0;
      let totalP = 0;
      let totalC = 0;
      let totalF = 0;
      const recentItems: string[] = [];
      logs.docs.forEach((d) => {
        const data = d.data();
        totalKcal += data.totals?.kcal ?? 0;
        totalP += data.totals?.p ?? 0;
        totalC += data.totals?.c ?? 0;
        totalF += data.totals?.f ?? 0;
        const name = data.items?.[0]?.name;
        if (name && recentItems.length < 5) recentItems.push(name);
      });
      ctx.today_food_logs = {
        count: logs.size,
        totals: { kcal: totalKcal, p: totalP, c: totalC, f: totalF },
        recent_items: recentItems,
      };
    } catch (e) {
      console.warn('[nutrition-agent] today_food_logs fetch failed:', e);
    }

    // Nutrition guides Ottawa pertinents
    try {
      const guides = await searchNutritionGuides(input.user_message, 3);
      if (guides.length > 0) {
        ctx.nutrition_guides_ottawa = guides.map((g) => ({
          section: g.title,
          summary: g.abstractSnippet,
          source: g.source,
        }));
      }
    } catch (e) {
      console.warn('[nutrition-agent] nutrition_guides fetch failed:', e);
    }

    // Hydratation — Phase 4 data-layer
    try {
      const hydration = await getHydrationSnapshot(input.uid);
      if (hydration) ctx.hydration = hydration;
    } catch (e) {
      console.warn('[nutrition-agent] hydration fetch failed:', e);
    }

    // Substances — Phase 5 data-layer (caféine/alcool/nicotine impact macros + récup)
    try {
      const substances = await getSubstancesSnapshot(input.uid);
      if (substances) ctx.substances = substances;
    } catch (e) {
      console.warn('[nutrition-agent] substances fetch failed:', e);
    }

    // Cravings granulaires — Phase 6 data-layer (extension checkins_daily)
    try {
      const cravings = await getCravingsSnapshot(input.uid);
      if (cravings) ctx.cravings = cravings;
    } catch (e) {
      console.warn('[nutrition-agent] cravings fetch failed:', e);
    }

    // Audit 2026-05-29 : favorite_recipes + shopping_lists retirés — ils étaient
    // fetchés mais renvoyaient des IDs opaques inexploitables (jamais référencés
    // par le prompt). Coût Firestore + tokens sans valeur.

    // Protocole sèche seedé (référence par tranche de poids) — ancre les recos
    // quand l'objectif est une perte. Null si la collection n'est pas seedée.
    try {
      if (profile?.objective === 'lose_weight' && typeof profile.weight_kg === 'number') {
        const proto = await getProtocolForUser(profile.weight_kg, 1);
        if (proto) ctx.cut_protocol_reference = proto;
      }
    } catch (e) {
      console.warn('[nutrition-agent] cut protocol fetch failed:', e);
    }

    // Jeûne intermittent — état de la fenêtre courante si un protocole est actif.
    // Le jeûne est dans le scope nutrition mais n'était jamais lu (audit 2026-05-29).
    try {
      const userSnap = await userRef.get();
      const fp = userSnap.data()?.fasting_protocol;
      if (fp?.active) ctx.fasting = getFastingState(fp);
    } catch (e) {
      console.warn('[nutrition-agent] fasting fetch failed:', e);
    }

    // Micronutriments : estime les apports sur ~14j (table CIQUAL) vs cibles
    // sportives. analyzeMicronutrientIntake n'affirme RIEN si les logs sont trop
    // partiels (garde-fou anti-fausse-carence). Débloque la détection réelle.
    try {
      const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      const snap = await userRef
        .collection('food_logs')
        .where('logged_at', '>=', since)
        .orderBy('logged_at', 'desc')
        .limit(150)
        .get();
      const byDay: Record<string, Array<{ name?: string; qty_g?: number }>> = {};
      snap.docs.forEach((d) => {
        const data = d.data();
        const day = (data.logged_at as string | undefined)?.slice(0, 10);
        if (!day) return;
        if (!byDay[day]) byDay[day] = [];
        for (const it of (data.items ?? []) as Array<{ name?: string; qty_g?: number }>) {
          byDay[day].push({ name: it?.name, qty_g: it?.qty_g });
        }
      });
      const loggedDays = Object.entries(byDay).map(([date, items]) => ({ date, items }));
      if (loggedDays.length > 0) {
        ctx.micronutrient_intake = analyzeMicronutrientIntake(loggedDays, profile?.sex ?? null);
      }
    } catch (e) {
      console.warn('[nutrition-agent] micronutrient analysis failed:', e);
    }

    // Sources scientifiques réelles pour grounder les citations (Helms, Phillips,
    // Garthe…) — sans ça l'agent les citait de mémoire. Le prompt impose de ne
    // citer QUE depuis ce tableau (audit 2026-05-29).
    const sci = await fetchScientificSources(input.user_message);
    if (sci.length > 0) ctx.scientific_sources = sci;

    return ctx;
  }
}
