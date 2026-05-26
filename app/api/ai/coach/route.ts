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
import { buildEnrichedSystemPrompt, buildUserContext } from '@/lib/vertex/context-builder';
import { buildCoachRagFragment } from '@/lib/features/rag-coach/context';

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

      // 3. Fetch the active plan (try a few legacy locations to maximize hit rate)
      let activePlan: Record<string, unknown> | undefined;
      try {
        const plansActive = await userRef
          .collection('plans')
          .where('active', '==', true)
          .limit(1)
          .get();
        if (!plansActive.empty) {
          activePlan = plansActive.docs[0].data();
        } else {
          // Fallback: most recent doc in plans/ or plans_history/
          const recentPlan = await userRef
            .collection('plans')
            .orderBy('created_at', 'desc')
            .limit(1)
            .get()
            .catch(() => null);
          if (recentPlan && !recentPlan.empty) {
            activePlan = recentPlan.docs[0].data();
          } else {
            const recentHistory = await userRef
              .collection('plans_history')
              .orderBy('date', 'desc')
              .limit(1)
              .get()
              .catch(() => null);
            if (recentHistory && !recentHistory.empty) {
              activePlan = recentHistory.docs[0].data();
            } else if (userData.active_plan) {
              // Some flows store the plan inline on the user doc
              activePlan = userData.active_plan;
            }
          }
        }
      } catch (planErr) {
        console.warn('[coach] failed to load active plan:', planErr);
      }

      // 4. Fetch bloodwork details if flag is active
      let bloodwork: Record<string, unknown> | undefined;
      if (flags.bloodworkUpload()) {
        try {
          const bloodworkSnap = await userRef
            .collection('bloodwork')
            .orderBy('date', 'desc')
            .limit(1)
            .get();
          if (!bloodworkSnap.empty) {
            bloodwork = bloodworkSnap.docs[0].data();
          }
        } catch (bloodworkError) {
          console.warn('Failed to load bloodwork data in coach prompt:', bloodworkError);
        }
      }

      // 5. Build the unified user context (single source of truth for the prompt)
      const ctx = buildUserContext({
        userData,
        activePlan,
        bloodwork,
        ragSources: searchResults,
      });

      // Decide which optional blocks to include based on feature flags so the
      // prompt stays minimal when a feature is off.
      const enriched = buildEnrichedSystemPrompt(COACH_SYSTEM_PROMPT, ctx, {
        includeProfile: true,
        includeActivePlan: true,
        includeProfilePath: flags.profilePaths(),
        includeGlp1: flags.glp1(),
        includeFasting: flags.fasting(),
        includeBloodwork: flags.bloodworkUpload(),
        includeRag: searchResults.length > 0,
        includeNotification: false,
      });

      // 6. Append profile-path coaching instructions when the flag is on.
      // (buildEnrichedSystemPrompt only injects a short marker; the long
      // instruction text lives in PROFILE_PATH_COACH_INSTRUCTIONS.)
      let profilePathInstruction = '';
      if (flags.profilePaths()) {
        const profilePath = (userData.profile_path || 'standard') as ProfilePath;
        const pathCoachInst = PROFILE_PATH_COACH_INSTRUCTIONS[profilePath];
        if (pathCoachInst) {
          profilePathInstruction = `\n${pathCoachInst}`;
        }
      }

      // 6.5 RAG coach : injecte top-K exos + 1-2 méthodes pertinents pour la
      // dernière question utilisateur, filtrés par niveau + équipement.
      // Cf. lib/features/rag-coach/context.ts. Empty string si query trop courte
      // ou si les indexes ne sont pas chargés (build:rag pas encore lancé).
      const ragCoachFragment = await buildCoachRagFragment(
        lastMessageText,
        userData.profile as { training_history?: string; training_environment?: any; available_equipment?: string[] } | undefined,
      );

      const fullSystemInstruction = `${enriched}${profilePathInstruction}${ragCoachFragment}`;

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

        // Persist a cleaned version of the message (without the <COACH_SAVE>
        // tag) so chat-history reloads don't expose the structured-data
        // block to the user. The raw stream still includes the tag so the
        // frontend can parse + POST it to /api/profile/update-fields.
        const stripCoachSaveTag = (s: string) => {
          let out = s.replace(/<COACH_SAVE>[\s\S]*?<\/COACH_SAVE>/g, '');
          const openIdx = out.indexOf('<COACH_SAVE>');
          if (openIdx !== -1) out = out.slice(0, openIdx);
          return out.trimEnd();
        };

        const flushPartial = async () => {
          const now = Date.now();
          if (now - lastFlushAt < FLUSH_INTERVAL_MS) return;
          lastFlushAt = now;
          try {
            await placeholderRef.update({ content: stripCoachSaveTag(accumulated) });
          } catch {
            // best-effort
          }
        };

        const finalize = async (status: 'done' | 'error', errorMsg?: string) => {
          try {
            await placeholderRef.update({
              content: stripCoachSaveTag(accumulated),
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
