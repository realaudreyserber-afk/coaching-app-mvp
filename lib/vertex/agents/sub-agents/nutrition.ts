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
import { searchNutritionGuides } from '@/lib/features/rag-sourcing/internal-corpus';
import { getCycleSnapshot } from '@/lib/features/cycle/store';
import { getHydrationSnapshot } from '@/lib/features/hydration/store';
import { getSubstancesSnapshot } from '@/lib/features/substances/store';
import { getCravingsSnapshot } from '@/lib/features/cravings/store';
import { getFavoriteRecipesSnapshot } from '@/lib/features/favorite-recipes/store';
import { getShoppingListsSnapshot } from '@/lib/features/shopping-lists/store';
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
    try {
      const snap = await userRef.get();
      const profile = snap.data();
      if (profile) {
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
          uses_glp1: profile.uses_glp1 ?? false,
        };
        isFemale = profile.sex === 'female';
      }
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
    try {
      const userSnap = await userRef.get();
      const goals = userSnap.data()?.goals;
      if (goals) {
        ctx.goals = {
          type: goals.type,
          target_weight: goals.target_weight,
          duration_chosen_weeks: goals.duration_chosen_weeks,
          recommended_weeks_min: goals.recommended_weeks_min,
        };
      }
    } catch (e) {
      console.warn('[nutrition-agent] goals fetch failed:', e);
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

    // Favorite recipes — Phase 12 (suggérer en priorité ce que l'user aime)
    try {
      const favRecipes = await getFavoriteRecipesSnapshot(input.uid);
      if (favRecipes) ctx.favorite_recipes = favRecipes;
    } catch (e) {
      console.warn('[nutrition-agent] favorite_recipes fetch failed:', e);
    }

    // Shopping lists — Phase 13 (état liste active)
    try {
      const shopping = await getShoppingListsSnapshot(input.uid);
      if (shopping) ctx.shopping_lists = shopping;
    } catch (e) {
      console.warn('[nutrition-agent] shopping_lists fetch failed:', e);
    }

    return ctx;
  }
}
