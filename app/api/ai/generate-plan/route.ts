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

      const safety = await checkUserBaseline({
        weightKg: userContext.baseline?.weight ?? userContext.profile?.weight,
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
      let systemInstruction = buildPlanGeneratorSystemPrompt(userLevel) + ragPlanFragment;
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
      `;

      const responseText = await generateText({
        model: process.env.VERTEX_AI_MODEL_PRO || 'gemini-2.5-pro',
        contents: [{ role: 'user', parts: [{ text: promptText }] }],
        systemInstruction,
        temperature: 0.3,
        responseMimeType: 'application/json',
        responseSchema: PLAN_RESPONSE_SCHEMA,
      });

      if (!responseText) {
        throw new Error("L'IA n'a retourné aucune réponse.");
      }

      const parsedPlan = PlanSchema.parse(parseLLMJson(responseText));

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
      
      // Update users doc with current plan ID
      batch.update(userRef, {
        plan_current_id: newPlanRef.id,
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
