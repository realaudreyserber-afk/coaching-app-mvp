/**
 * Adapter qui permet à /api/ai/coach de router vers le système multi-agent
 * (runAgentSession) tout en restant 100% compatible avec le format SSE attendu
 * par app/(app)/coach/page.tsx.
 *
 * Activé via env var `USE_MULTI_AGENT_BACKEND=1` (cf. route.ts).
 *
 * Différences fonctionnelles vs ancien coach :
 *   - PAS de streaming token-by-token sur la réponse finale (un seul chunk
 *     après ~15-25s). Trade-off accepté pour bénéficier de l'analyse
 *     multi-agent (meilleur routing, archive de session).
 *   - Profile path, GLP1, fasting flags : non utilisés (les sous-agents font
 *     leur propre fetchContext).
 *
 * Compatibilité conservée :
 *   - <COACH_SAVE> / <COACH_PLAN_PATCH> émis par le supervisor aggregate
 *     (cf. prompts/agents/supervisor.ts §PERSISTANCE) → le frontend les
 *     parse via le pipeline existant (/api/profile/update-fields + /api/coach/apply-patch).
 *   - Les balises sont incluses dans le chunk SSE mais STRIPPED avant la
 *     persistance coach_messages (chat history reste propre).
 *
 * Bénéfices :
 *   - Archive intégrale de chaque session dans agent_memory_backup
 *   - Routing intelligent (vraie spécialisation par domaine)
 *   - Cost tracking par session
 *   - Plus facile à débugger (chaque agent loggé séparément)
 */

import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import type { DocumentReference } from 'firebase-admin/firestore';
import { runAgentSession } from './supervisor';
import { buildRecentChat } from './recent-chat';

export interface RunMultiAgentCoachInput {
  req: NextRequest;
  uid: string;
  userRef: DocumentReference;
  messages: Array<{ role?: string; content?: string }>;
  lastMessageText: string;
}

export async function runMultiAgentCoach(
  input: RunMultiAgentCoachInput,
): Promise<NextResponse> {
  const { req, uid, userRef, messages, lastMessageText } = input;

  // recent_chat pour le supervisor (helper partagé avec la route coach-multi).
  const recentChat = buildRecentChat(messages);

  const acceptHeader = req.headers.get('accept') || '';
  const wantsStream = acceptHeader.includes('text/event-stream');

  // Mode non-streaming : appel direct, retour JSON (pour curl, tests, fallback)
  if (!wantsStream) {
    try {
      const result = await runAgentSession({
        uid,
        user_message: lastMessageText,
        recent_chat: recentChat,
      });

      // Persister la réponse dans coach_messages (même collection que l'ancien
      // coach, pour que l'historique chat soit cohérent peu importe le backend).
      // On strip les balises avant persistance pour ne pas polluer l'historique.
      void persistAssistantMessage(
        userRef,
        stripCoachTags(result.finalResponse),
        result.sessionRecord.session_id,
      ).catch((e) => console.warn('[coach-multi-adapter] persist failed:', e));

      return NextResponse.json(
        {
          response: result.finalResponse, // balises gardées pour le client
          sources: [],
          session_id: result.sessionRecord.session_id,
          cost_estimate_usd: result.sessionRecord.cost_estimate_usd,
        },
        { status: 200 },
      );
    } catch (err) {
      console.error('[coach-multi-adapter] non-stream session failed:', err);
      return NextResponse.json(
        { error: 'Le Coach IA a rencontré une erreur.' },
        { status: 500 },
      );
    }
  }

  // Mode streaming SSE — émet dans le format ATTENDU par coach/page.tsx :
  //   event: message  data: { messageId }
  //   event: chunk    data: { text }      ← un seul chunk avec la réponse complète
  //   event: done     data: {}
  //   event: error    data: { error }     (en cas d'échec)

  // Création du placeholder coach_message (même pattern que l'ancien coach)
  const placeholderRef = await userRef.collection('coach_messages').add({
    role: 'assistant',
    content: '',
    sources: [],
    timestamp: new Date().toISOString(),
    streaming: true,
    backend: 'multi-agent', // pour identifier les messages produits par le nouveau système
  });

  const encoder = new TextEncoder();

  const finalize = async (
    status: 'done' | 'error',
    content: string,
    sessionId?: string,
    errorMsg?: string,
  ) => {
    try {
      await placeholderRef.update({
        content,
        streaming: false,
        ...(sessionId ? { session_id: sessionId } : {}),
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
          encoder.encode(
            `event: message\ndata: ${JSON.stringify({ messageId: placeholderRef.id })}\n\n`,
          ),
        );

        const result = await runAgentSession({
          uid,
          user_message: lastMessageText,
          recent_chat: recentChat,
          // Note : pas d'onPhase pour le moment — on n'expose pas les phases
          // dans le format legacy car le UI coach/page.tsx ne sait pas les
          // afficher. Si besoin futur, on peut emit du texte progressif
          // ("Analyse en cours...") via onPhase.
        });

        const finalText = result.finalResponse;
        // On émet le texte BRUT (avec balises COACH_SAVE / COACH_PLAN_PATCH si
        // présentes) — le frontend coach/page.tsx parse + strip pour l'affichage,
        // et POST les balises vers /api/profile/update-fields et /api/coach/apply-patch.
        controller.enqueue(
          encoder.encode(
            `event: chunk\ndata: ${JSON.stringify({ text: finalText })}\n\n`,
          ),
        );

        // Pour la persistance coach_messages, on strip les balises pour ne pas
        // polluer l'historique chat (le frontend ne les ré-affiche pas non plus).
        await finalize('done', stripCoachTags(finalText), result.sessionRecord.session_id);

        controller.enqueue(encoder.encode(`event: done\ndata: {}\n\n`));
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[coach-multi-adapter] stream session failed:', err);
        await finalize(
          'error',
          "Une erreur interne est survenue. Réessaie dans un instant.",
          undefined,
          msg,
        );
        controller.enqueue(
          encoder.encode(`event: error\ndata: ${JSON.stringify({ error: msg })}\n\n`),
        );
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
    async cancel() {
      // Audit 2026-05-28 #18 : au disconnect client, NE PAS réécrire content=''
      // — ça effaçait un message déjà streamé (vide au reload). runAgentSession
      // poursuit côté serveur et start()/finalize('done') persistera la réponse
      // complète. On ne fait qu'horodater le disconnect (informatif).
      try {
        await placeholderRef.update({ client_disconnected_at: new Date().toISOString() });
      } catch {
        /* best-effort */
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

async function persistAssistantMessage(
  userRef: DocumentReference,
  content: string,
  sessionId: string,
): Promise<void> {
  await userRef.collection('coach_messages').add({
    role: 'assistant',
    content,
    sources: [],
    timestamp: new Date().toISOString(),
    streaming: false,
    backend: 'multi-agent',
    session_id: sessionId,
    finalized_at: new Date().toISOString(),
  });
}

/**
 * Retire les balises <COACH_SAVE> et <COACH_PLAN_PATCH> du texte avant
 * persistance dans coach_messages. Le frontend les parse depuis le SSE et
 * les POST vers les endpoints dédiés ; on ne veut pas qu'elles polluent
 * l'historique chat (l'user ne doit pas voir le JSON brut).
 */
export function stripCoachTags(text: string): string {
  let out = text.replace(/<COACH_SAVE>[\s\S]*?<\/COACH_SAVE>/g, '');
  out = out.replace(/<COACH_PLAN_PATCH>[\s\S]*?<\/COACH_PLAN_PATCH>/g, '');
  // Cas où une balise ouvrante n'a pas de fermante (génération coupée) — strip jusqu'à la fin
  for (const tag of ['<COACH_SAVE>', '<COACH_PLAN_PATCH>']) {
    const openIdx = out.indexOf(tag);
    if (openIdx !== -1) out = out.slice(0, openIdx);
  }
  // Cas symétrique : balise FERMANTE orpheline (sans ouvrante, ex. output LLM
  // malformé "texte </COACH_SAVE> suite") — elle ne doit pas rester visible
  // dans l'historique chat. On retire toute fermante résiduelle.
  out = out.replace(/<\/COACH_SAVE>/g, '').replace(/<\/COACH_PLAN_PATCH>/g, '');
  return out.trimEnd();
}
