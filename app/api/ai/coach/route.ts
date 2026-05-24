import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/firebase/auth-middleware';
import { adminDb } from '@/lib/firebase/admin';
import { checkRateLimit } from '@/lib/firebase/rate-limit';
import { generateText, generateTextStream } from '@/lib/vertex/client';
import { COACH_SYSTEM_PROMPT } from '@/lib/vertex/prompts/coach';
import { runSafetyCheck } from '@/lib/vertex/safety';
import { flags } from '@/lib/features/flags';
import { searchScientificCorpus, SearchResult } from '@/lib/features/rag-sourcing/client';
import { buildRAGPrompt } from '@/lib/features/rag-sourcing/prompts';
import { PROFILE_PATH_COACH_INSTRUCTIONS } from '@/lib/features/profile-paths/prompts';
import { ProfilePath } from '@/lib/features/profile-paths/schema';

export async function POST(req: NextRequest) {
  return withAuth(req, async (authenticatedReq, user) => {
    try {
      const uid = user.uid;

      const rl = await checkRateLimit(uid, {
        scope: 'ai_coach',
        perMinute: 20,
        perHour: 200,
      });
      if (!rl.ok) {
        return NextResponse.json(
          {
            error: 'Limite de requêtes atteinte. Réessaye dans quelques instants.',
            retryAfterSec: rl.retryAfterSec,
          },
          {
            status: 429,
            headers: rl.retryAfterSec ? { 'Retry-After': String(rl.retryAfterSec) } : {},
          }
        );
      }

      const userRef = adminDb.collection('users').doc(uid);
      const userSnap = await userRef.get();
      
      if (!userSnap.exists) {
        return NextResponse.json(
          { error: 'Profil utilisateur introuvable.' },
          { status: 404 }
        );
      }
      
      const userData = userSnap.data() || {};
      const { messages } = await req.json();

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return NextResponse.json(
          { error: 'Historique des messages manquant.' },
          { status: 400 }
        );
      }

      // Extract last user message
      const lastMessageObj = messages[messages.length - 1];
      const lastMessageText = typeof lastMessageObj.content === 'string'
        ? lastMessageObj.content
        : lastMessageObj.parts?.[0]?.text || '';

      const safety = await runSafetyCheck(lastMessageText, {
        weightKg: userData.profile?.weight,
        heightCm: userData.profile?.height,
      });
      if (safety.flagged) {
        return NextResponse.json({
          response: safety.message,
          sources: [],
          safety: { flagged: true, reason: safety.reason },
        }, { status: 200 });
      }

      // 2. Perform RAG Sourcing if flag is active
      let searchResults: SearchResult[] = [];
      let augmentedUserMessage = lastMessageText;

      if (flags.ragSourcing() && lastMessageText.trim().length > 5) {
        try {
          // Extract keywords for scientific search using Gemini Flash
          const extractPrompt = `
Analyze this health/nutrition/fitness query and return 2 or 3 English search terms optimized for PubMed.
Query: "${lastMessageText}"
Return ONLY the English terms separated by spaces. No other text or punctuation.
`;
          const extractedKeywords = await generateText({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: extractPrompt }] }],
            temperature: 0.1,
          });

          const keywords = extractedKeywords.trim();
          if (keywords) {
            searchResults = await searchScientificCorpus(keywords);
            augmentedUserMessage = buildRAGPrompt(lastMessageText, searchResults);
          }
        } catch (ragError) {
          console.warn('RAG Sourcing failed, continuing without citations:', ragError);
        }
      }

      // 3. Prepare contextual system instructions with user profile and plan details
      let activePlanStr = "Aucun plan d'action nutritionnel actif.";
      const plansRef = userRef.collection('plans');
      const activePlansSnap = await plansRef.where('active', '==', true).limit(1).get();
      if (!activePlansSnap.empty) {
        const p = activePlansSnap.docs[0].data();
        activePlanStr = `Plan nutritionnel actif : ${p.kcal} kcal (${p.macros?.p}g P, ${p.macros?.c}g C, ${p.macros?.f}g F). Type: ${p.strategy_nutrition}. Objectif: ${p.strategy_training}.`;
      }

      const userProfileStr = `
PROFIL DE L'UTILISATEUR ACTUEL :
- Prénom/Pseudo : ${userData.profile?.name || 'Abonné'}
- Objectif : ${userData.goals?.primary_goal || 'Recomposition corporelle'}
- Poids actuel : ${userData.baseline?.weight_start || 'N/A'} kg, Poids cible : ${userData.goals?.target_weight || 'N/A'} kg
- TDEE théorique : ${userData.profile?.tdee_theoretical || 'N/A'} kcal
- TDEE adaptatif : ${userData.profile?.tdee_adaptive || 'Non calculé'} kcal (à utiliser en priorité si disponible !)
- ${activePlanStr}
`;

      // GLP-1 now stored in medical.glp1 map per ADR-006 (no extra fetch needed)
      let glp1Instruction = "";
      if (flags.glp1()) {
        const glp1Data = userData?.medical?.glp1;
        if (glp1Data && glp1Data.active) {
          glp1Instruction = `
[TRAITEMENT GLP-1 ACTIF : ${glp1Data.molecule?.toUpperCase()}]
L'utilisateur prend actuellement du ${glp1Data.molecule} (Dose: ${glp1Data.dose || "N/A"}, Fréquence: ${glp1Data.frequency || "hebdo"}).
Date de début : ${glp1Data.start_date || glp1Data.startDate || "N/A"}.
Effets secondaires ressentis : ${(glp1Data.side_effects || glp1Data.sideEffects)?.join(', ') || "aucun"}.

CONSIGNES DE SÉCURITÉ ET NUTRITION POUR GLP-1 :
1. Risque de fonte musculaire : Augmente la cible protéique de l'utilisateur de +20% (viser 2.0g à 2.2g de protéines/kg de poids de corps). Rappelle l'importance vitale des protéines et de la musculation.
2. Gestion des nausées : En cas de nausées, propose de consommer de plus petites portions fractionnées, d'éviter les aliments trop gras ou très sucrés, et de bien s'hydrater par petites gorgées.
3. Disclaimer médical : Ajoute impérativement un rappel bienveillant indiquant que tes conseils de coach IA ne remplacent en aucun cas un suivi médical régulier par le médecin prescripteur.
`;
        }
      }

      // Fetch profile path instructions if active
      let profilePathInstruction = "";
      if (flags.profilePaths()) {
        const profilePath = (userData.profile_path || 'standard') as ProfilePath;
        const pathCoachInst = PROFILE_PATH_COACH_INSTRUCTIONS[profilePath];
        if (pathCoachInst) {
          profilePathInstruction = `\n${pathCoachInst}`;
        }
      }

      // Fetch fasting protocol details if active
      let fastingInstruction = "";
      if (flags.fasting() && userData.fasting_protocol?.active) {
        const fp = userData.fasting_protocol;
        fastingInstruction = `
\n[PROTOCOLE DE JEÛNE INTERMITTENT ACTIF : ${fp.type}]
L'utilisateur suit un jeûne intermittent de type ${fp.type}. Sa fenêtre de repas est de ${fp.eating_window_start} à ${fp.eating_window_end}.
Jours actifs : ${fp.days_active?.join(', ')}.
Adapte tes conseils de nutrition et de repas pour s'aligner sur cette fenêtre d'alimentation. S'il mentionne des sensations de faim en dehors, donne-lui des stratégies d'hydratation (eau, thé/café noir) et d'occupation de l'esprit.
`;
      }

      // Fetch bloodwork details if flag is active
      let bloodworkInstruction = "";
      if (flags.bloodworkUpload()) {
        try {
          const bloodworkSnap = await userRef.collection('bloodwork')
            .orderBy('date', 'desc')
            .limit(1)
            .get();
          if (!bloodworkSnap.empty) {
            const bw = bloodworkSnap.docs[0].data();
            const markersStr = bw.markers?.map((m: any) => 
              `- ${m.name} : ${m.value} ${m.unit} (Réf : ${m.referenceRange}) [Statut : ${m.status}]`
            ).join('\n') || "Aucun marqueur extrait.";

            bloodworkInstruction = `
\n[DERNIER BILAN SANGUIN - DATE : ${bw.date || "N/A"}]
Résumé de l'analyse : ${bw.summary || "N/A"}
Marqueurs extraits :
${markersStr}

CONSIGNES DE NUTRITION/COACHING LIÉES AU BILAN SANGUIN :
- Tu as visibilité sur ces biomarqueurs sanguins de l'utilisateur.
- Adapte tes conseils pour soutenir sa santé (ex: si le cholestérol LDL est élevé, privilégie les conseils sur les graisses insaturées, l'avoine et les fibres; si le fer/ferritine est bas, suggère des sources de fer héminique ou de vitamine C pour favoriser l'absorption).
- Attention : Ne pose jamais de diagnostic médical et ne remplace jamais un médecin. Mentionne toujours de consulter un médecin en cas de valeurs hors-normes importantes.
`;
          }
        } catch (bloodworkError) {
          console.warn("Failed to load bloodwork data in coach prompt:", bloodworkError);
        }
      }

      const fullSystemInstruction = `${COACH_SYSTEM_PROMPT}\n${userProfileStr}\n${glp1Instruction}\n${profilePathInstruction}\n${fastingInstruction}\n${bloodworkInstruction}`;

      // 4. Format chat history for Gemini API
      // Translate messages to Gemini API format (role: 'user' or 'model')
      const formattedContents = messages.map((m: any, index: number) => {
        // If it's the last user message, we inject the augmented prompt containing RAG results
        const isLastMessage = index === messages.length - 1;
        const role = m.role === 'assistant' || m.role === 'model' ? 'model' : 'user';
        const text = isLastMessage && role === 'user' ? augmentedUserMessage : (m.content || m.parts?.[0]?.text || '');
        
        return {
          role,
          parts: [{ text }],
        };
      });

      const acceptHeader = req.headers.get('accept') || '';
      const wantsStream = acceptHeader.includes('text/event-stream');

      if (wantsStream) {
        const placeholderRef = await userRef.collection('coach_messages').add({
          role: 'assistant',
          content: '',
          sources: searchResults,
          timestamp: new Date().toISOString(),
          streaming: true,
        });

        const encoder = new TextEncoder();
        let accumulated = '';
        let lastFlushAt = 0;
        const FLUSH_INTERVAL_MS = 600;

        const flushPartial = async () => {
          const now = Date.now();
          if (now - lastFlushAt < FLUSH_INTERVAL_MS) return;
          lastFlushAt = now;
          try {
            await placeholderRef.update({ content: accumulated });
          } catch {
            // best-effort
          }
        };

        const finalize = async (status: 'done' | 'error', errorMsg?: string) => {
          try {
            await placeholderRef.update({
              content: accumulated,
              streaming: false,
              ...(status === 'error' ? { error: errorMsg ?? 'unknown' } : {}),
              finalized_at: new Date().toISOString(),
            });
          } catch {
            // best-effort
          }
        };

        const stream = new ReadableStream({
          async start(controller) {
            try {
              controller.enqueue(
                encoder.encode(`event: message\ndata: ${JSON.stringify({ messageId: placeholderRef.id })}\n\n`)
              );

              if (searchResults.length > 0) {
                controller.enqueue(
                  encoder.encode(`event: sources\ndata: ${JSON.stringify(searchResults)}\n\n`)
                );
              }

              for await (const chunk of generateTextStream({
                model: process.env.VERTEX_AI_MODEL_PRO || 'gemini-2.5-pro',
                contents: formattedContents,
                systemInstruction: fullSystemInstruction,
                temperature: 0.4,
                signal: req.signal,
              })) {
                accumulated += chunk;
                controller.enqueue(
                  encoder.encode(`event: chunk\ndata: ${JSON.stringify({ text: chunk })}\n\n`)
                );
                void flushPartial();
              }

              await finalize('done');
              controller.enqueue(encoder.encode(`event: done\ndata: {}\n\n`));
              controller.close();
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              await finalize('error', msg);
              controller.enqueue(
                encoder.encode(`event: error\ndata: ${JSON.stringify({ error: msg })}\n\n`)
              );
              controller.close();
            }
          },
          async cancel() {
            await finalize('error', 'client_disconnected');
          },
        });

        return new NextResponse(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
          },
        });
      }

      const coachResponse = await generateText({
        model: process.env.VERTEX_AI_MODEL_PRO || 'gemini-2.5-pro',
        contents: formattedContents,
        systemInstruction: fullSystemInstruction,
        temperature: 0.4,
      });

      return NextResponse.json({
        response: coachResponse,
        sources: searchResults,
      }, { status: 200 });

    } catch (error) {
      console.error('Error in coach API route:', error);
      const errMsg = error instanceof Error ? error.message : String(error);
      return NextResponse.json(
        { error: 'Le Coach IA a rencontré une erreur.', details: errMsg },
        { status: 500 }
      );
    }
  });
}
