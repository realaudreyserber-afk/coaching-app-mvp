import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { withAuth } from '@/lib/firebase/auth-middleware';
import { checkRateLimit } from '@/lib/firebase/rate-limit';
import { generateText, parseLLMJson } from '@/lib/vertex/client';
import { buildPlanGeneratorSystemPrompt } from '@/lib/vertex/prompts/plan-generator';
import { buildPlanRagFragment } from '@/lib/features/rag-coach/context';
import { PlanSchema } from '@/lib/vertex/schemas';
import { PLAN_RESPONSE_SCHEMA } from '@/lib/vertex/response-schemas';
import { checkUserBaseline } from '@/lib/vertex/safety';
import { flags } from '@/lib/features/flags';
import { detectProfilePath } from '@/lib/features/profile-paths/detector';
import { PROFILE_PATH_PLAN_INSTRUCTIONS } from '@/lib/features/profile-paths/prompts';

// Recalcule les champs déterministes que l'IA ne génère plus (pour réduire
// les tokens output et passer sous le timeout Vercel 60s) :
//   - items[].kcal = p*4 + c*4 + f*9
//   - meal.macros = somme des items[].p/c/f
//   - meal.approx_kcal = somme des items[].kcal
// Idempotent : si l'IA les a quand même générés (sortie hors-schema), on
// respecte ses valeurs.
function enrichPlanOutput(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const plan = raw as Record<string, any>;
  if (!Array.isArray(plan.meals_template)) return plan;

  for (const meal of plan.meals_template) {
    if (!meal || typeof meal !== 'object' || !Array.isArray(meal.items)) continue;

    for (const item of meal.items) {
      if (!item || typeof item !== 'object') continue;
      if (
        typeof item.kcal !== 'number' &&
        typeof item.p === 'number' &&
        typeof item.c === 'number' &&
        typeof item.f === 'number'
      ) {
        item.kcal = Math.round(item.p * 4 + item.c * 4 + item.f * 9);
      }
    }

    if (!meal.macros || typeof meal.macros !== 'object') {
      const totals = meal.items.reduce(
        (acc: { p: number; c: number; f: number }, it: any) => ({
          p: acc.p + (typeof it?.p === 'number' ? it.p : 0),
          c: acc.c + (typeof it?.c === 'number' ? it.c : 0),
          f: acc.f + (typeof it?.f === 'number' ? it.f : 0),
        }),
        { p: 0, c: 0, f: 0 },
      );
      meal.macros = {
        p: Math.round(totals.p),
        c: Math.round(totals.c),
        f: Math.round(totals.f),
      };
    }

    if (typeof meal.approx_kcal !== 'number') {
      meal.approx_kcal = Math.round(
        meal.items.reduce((sum: number, it: any) => sum + (typeof it?.kcal === 'number' ? it.kcal : 0), 0),
      );
    }
  }

  return plan;
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (authenticatedReq, user) => {
    try {
      const uid = user.uid;

      const rl = await checkRateLimit(uid, {
        scope: 'ai_generate_plan',
        perHour: 5,
      });
      if (!rl.ok) {
        return NextResponse.json(
          { error: 'Trop de générations de plan récentes. Patiente avant de réessayer.', retryAfterSec: rl.retryAfterSec },
          { status: 429 }
        );
      }

      const userRef = adminDb.collection('users').doc(uid);
      const userSnap = await userRef.get();
      
      if (!userSnap.exists) {
        return NextResponse.json(
          { error: "Profil utilisateur introuvable." },
          { status: 404 }
        );
      }
      
      const userData = userSnap.data();
      
      // 2. Prepare user context for Vertex AI
      const userContext = {
        profile: userData?.profile,
        goals: userData?.goals,
        medical: userData?.medical,
        baseline: userData?.baseline,
      };
      
      // Validate that baseline data exists
      if (!userContext.profile || !userContext.goals || !userContext.baseline) {
        return NextResponse.json(
          { error: "Données de base incomplètes pour générer un plan." },
          { status: 400 }
        );
      }

      const currentWeight = userContext.profile?.weight ?? userContext.baseline?.weight;

      const safety = await checkUserBaseline({
        weightKg: currentWeight,
        heightCm: userContext.profile?.height,
      });
      if (safety.flagged) {
        return NextResponse.json({
          error: safety.message,
          safety: { flagged: true, reason: safety.reason },
        }, { status: 403 });
      }

      // 2.5 Detect profile path (GLP-1 now stored in medical.glp1 map per ADR-006)
      const glp1Active = userData?.medical?.glp1?.active === true;
      const profilePath = detectProfilePath({ ...userContext, glp1Active });

      // Save detected profile path to Firestore if enabled
      if (flags.profilePaths()) {
        await userRef.update({ profile_path: profilePath });
      }

      // Customize system instructions based on profile paths and fasting.
      // Wave 4B: the exercise library is now injected via RAG retrieve
      // (pattern + level + equipment filtered) instead of a flat dump.
      const trainingHistory = (userContext.profile as Record<string, unknown> | undefined)
        ?.training_history;
      const userLevel: "debutant" | "intermediaire" | "avance" =
        trainingHistory === "beginner"
          ? "debutant"
          : trainingHistory === "advanced"
            ? "avance"
            : "intermediaire";

      // RAG retrieve : ~40-50 exos couvrant tous les patterns essentiels,
      // filtrés par niveau + environnement (gym / home_gym / home_bodyweight).
      const ragPlanFragment = await buildPlanRagFragment(
        userContext.profile as { training_history?: string; training_environment?: any; available_equipment?: string[] } | undefined,
      );
      // Merge all dietary options from profile, medical, and nutrition sub-objects for the generator prompt
      const mergedFoodProfile = {
        ...userData?.profile,
        ...userData?.medical,
        ...userData?.nutrition,
      };
      let systemInstruction = buildPlanGeneratorSystemPrompt(userLevel, mergedFoodProfile) + ragPlanFragment;
      if (flags.profilePaths()) {
        const pathInstructions = PROFILE_PATH_PLAN_INSTRUCTIONS[profilePath];
        if (pathInstructions) {
          systemInstruction += `\n${pathInstructions}`;
        }
      }

      if (flags.fasting() && userData?.fasting_protocol?.active) {
        const fp = userData.fasting_protocol;
        systemInstruction += `
\nCONSIGNES SPÉCIFIQUES POUR LE JEÛNE INTERMITTENT :
L'utilisateur suit un protocole de jeûne intermittent de type ${fp.type}.
Sa fenêtre d'alimentation (repas) est de ${fp.eating_window_start} à ${fp.eating_window_end}.
Jours de jeûne actifs : ${fp.days_active?.join(', ')}.
Adapte le plan pour que les repas soient concentrés dans cette fenêtre. Suggère de consommer l'essentiel de l'énergie et des protéines au cours de cette période. Hydratation importante en dehors de la fenêtre.
`;
      }

      // 3. Call unified text generator (Gemini Pro or Vertex AI) with JSON constraint
      const promptText = `
Génère un plan personnalisé complet basé sur les données de l'utilisateur suivantes :
${JSON.stringify(userContext, null, 2)}

IMPORTANT : Calibre TOUS les calculs énergétiques (BMR, TDEE, déficit, cible kcal, macros) en utilisant le poids actuel de l'utilisateur : ${currentWeight} kg.
Ne te base pas sur le poids de départ (baseline.weight) s'il est différent.
Le sexe biologique déclaré de l'utilisateur est : ${userContext.profile?.sex === 'female' ? 'female (femme)' : 'male (homme)'}. Respecte scrupuleusement ce sexe biologique dans tes justifications.
      `;

      const responseText = await generateText({
        // Upgrade Pro 2.5 → Flash 3.5 (génération Gemini 3.x). Flash 3.5
        // dépasse Pro 2.5 sur reasoning + instruction following + JSON
        // schema generation tout en étant ~2-3× plus rapide en JSON
        // structuré, ce qui résout aussi le timeout Vercel 60s rencontré
        // sur generate-plan avec Pro 2.5. Validé en prod 2026-05-27.
        // Note : revérifier que la règle §3bis du prompt (Katch-McArdle
        // si bf_pct fourni) est bien suivie — Flash peut fallback sur
        // Mifflin si bf_method == 'photo' (jugé incertain).
        // Old: model: process.env.VERTEX_AI_MODEL_PRO || 'gemini-2.5-pro',
        model: 'gemini-3.5-flash',
        contents: [{ role: 'user', parts: [{ text: promptText }] }],
        systemInstruction,
        temperature: 0.3,
        responseMimeType: 'application/json',
        responseSchema: PLAN_RESPONSE_SCHEMA,
      });

      if (!responseText) {
        throw new Error("L'IA n'a retourné aucune réponse.");
      }

      const parsedPlan = PlanSchema.parse(enrichPlanOutput(parseLLMJson(responseText)));

      // 5. Save the generated plan in subcollection plans/
      const planData = {
        ...parsedPlan,
        active: true,
        date_start: new Date().toISOString().split('T')[0], // YYYY-MM-DD
        source: 'ai',
        created_at: new Date().toISOString(),
      };

      const plansCollectionRef = userRef.collection('plans');
      
      // Deactivate all previous plans before creating the new active one
      const activePlansSnap = await plansCollectionRef.where('active', '==', true).get();
      const batch = adminDb.batch();
      activePlansSnap.docs.forEach((doc) => {
        batch.update(doc.ref, { active: false });
      });
      
      // Create new plan doc
      const newPlanRef = plansCollectionRef.doc();
      batch.set(newPlanRef, planData);
      
      // Update users doc with current plan ID + mark onboarding as completed.
      // The `onboarding_completed` flag is the authoritative marker used by
      // AuthProvider + (app) layout guard to decide whether to force the user
      // back to /onboarding or let them in /dashboard. Setting it server-side
      // here (rather than client-side in step 11) guarantees the flag only
      // flips when a plan was actually persisted.
      batch.update(userRef, {
        plan_current_id: newPlanRef.id,
        onboarding_completed: true,
        onboarding_completed_at: new Date().toISOString(),
      });

      await batch.commit();

      return NextResponse.json({
        success: true,
        planId: newPlanRef.id,
        plan: planData,
      });
      
    } catch (error) {
      console.error("Error in generate-plan route:", error);
      const errMsg = error instanceof Error ? error.message : String(error);
      
      // Handle Zod validation errors or JSON parse errors
      return NextResponse.json(
        { 
          error: "Une erreur est survenue lors de la génération du plan par l'IA.", 
          details: errMsg
        },
        { status: 500 }
      );
    }
  });
}
