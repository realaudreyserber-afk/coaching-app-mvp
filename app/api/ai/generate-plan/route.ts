import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { withAuth } from '@/lib/firebase/auth-middleware';
import { vertexAI } from '@/lib/vertex/client';
import { PLAN_GENERATOR_SYSTEM_PROMPT } from '@/lib/vertex/prompts/plan-generator';
import { PlanSchema } from '@/lib/vertex/schemas';

export async function POST(req: NextRequest) {
  return withAuth(req, async (authenticatedReq, user) => {
    try {
      const uid = user.uid;
      
      // 1. Fetch user data from Firestore
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

      // 3. Call Vertex AI using Gemini Pro with JSON constraint
      const model = vertexAI.getGenerativeModel({
        model: process.env.VERTEX_AI_MODEL_PRO || 'gemini-2.5-pro',
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.3,
        },
        systemInstruction: {
          role: 'system',
          parts: [{ text: PLAN_GENERATOR_SYSTEM_PROMPT }],
        },
      });

      const promptText = `
Génère un plan personnalisé complet basé sur les données de l'utilisateur suivantes :
${JSON.stringify(userContext, null, 2)}
      `;

      const response = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: promptText }] }],
      });

      const responseResult = response.response;
      const responseText = responseResult.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!responseText) {
        throw new Error("L'IA n'a retourné aucune réponse.");
      }

      // 4. Parse & validate the JSON with Zod
      const parsedPlan = PlanSchema.parse(JSON.parse(responseText));

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
