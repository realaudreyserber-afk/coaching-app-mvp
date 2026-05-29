/**
 * /api/ai/coach-multi — endpoint du système multi-agents.
 *
 * En PARALLÈLE de /api/ai/coach (qui reste intact). Activée par env var
 * `ENABLE_COACH_MULTI=1`. Tant que pas validée end-to-end, le client coach
 * (app/(app)/coach/page.tsx) ne doit PAS la consommer.
 *
 * Flow :
 *   1. Auth + rate limit (plus serré que /coach car ~9 appels Gemini max/session)
 *   2. Safety fast-path (réutilise lib/vertex/safety.ts — keywords + BMI)
 *   3. Si flagged → réponse JSON 200 standard (pas SSE)
 *   4. Sinon : SSE stream avec phases (route → agent_start/finish → aggregate_start → chunk → done)
 *
 * Events SSE émis :
 *   - route_decided  : { agents: SubAgentName[], skip: boolean, reasoning: string }
 *   - agent_start    : { agent: SubAgentName, reason: string }
 *   - agent_finish   : { agent: SubAgentName, severity, duration_ms }
 *   - aggregate_start: { }
 *   - chunk          : { text: string }  ← réponse coach unifiée (un seul chunk pour v1)
 *   - done           : { session_id, cost_estimate_usd }
 *   - error          : { message: string } ← en cas d'échec fatal
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/firebase/auth-middleware';
import { adminDb } from '@/lib/firebase/admin';
import { checkRateLimit } from '@/lib/firebase/rate-limit';
import { runSafetyCheck } from '@/lib/vertex/safety';
import { runAgentSession, type PhaseEvent } from '@/lib/vertex/agents/supervisor';
import { buildRecentChat } from '@/lib/vertex/agents/recent-chat';

// Vercel : laisser 60s au max — 1 route + N sous-agents + 1 aggregate = jusqu'à 9 appels Gemini.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  return withAuth(req, async (_authReq, user) => {
    // 1. Feature flag — ne pas activer en prod tant que pas validé E2E
    if (process.env.ENABLE_COACH_MULTI !== '1') {
      return NextResponse.json(
        { error: 'multi-agent system not enabled' },
        { status: 503 },
      );
    }

    const uid = user.uid;

    // 2. Rate limit (plus serré que /coach standard — chaque session coûte plus)
    const rl = await checkRateLimit(uid, {
      scope: 'ai_coach_multi',
      perMinute: 5,
      perHour: 50,
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
        },
      );
    }

    // 3. Parse + validate payload
    let payload: { messages?: Array<{ role?: string; content?: string }> };
    try {
      payload = await req.json();
    } catch {
      return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
    }
    const messages = payload.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Historique des messages manquant.' }, { status: 400 });
    }
    const lastMsg = messages[messages.length - 1];
    const lastUserMsg =
      typeof lastMsg?.content === 'string' ? lastMsg.content.trim() : '';
    if (!lastUserMsg) {
      return NextResponse.json({ error: 'Message vide.' }, { status: 400 });
    }

    // 4. Profile pour le safety context (BMI)
    const userRef = adminDb.collection('users').doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: 'Profil utilisateur introuvable.' }, { status: 404 });
    }
    const userData = userSnap.data() ?? {};

    // 5. Safety fast-path (réutilise /coach existant — keywords FR + BMI)
    const safety = await runSafetyCheck(lastUserMsg, {
      weightKg: userData.profile?.weight,
      heightCm: userData.profile?.height,
    });
    if (safety.flagged) {
      // Pas de SSE pour les flagged — réponse directe pour ne pas générer
      // une session multi-agent inutile et coûteuse.
      return NextResponse.json(
        {
          response: safety.message,
          safety: { flagged: true, reason: safety.reason },
        },
        { status: 200 },
      );
    }

    // 6. Préparer recent_chat (helper partagé avec coach-route-adapter).
    const recentChat = buildRecentChat(messages);

    // 7. SSE stream avec phases
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sse = (event: string, data: unknown) => {
          try {
            controller.enqueue(
              encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
            );
          } catch (e) {
            // controller peut être déjà fermé si le client a disconnect
            console.warn('[coach-multi] sse enqueue failed:', e);
          }
        };

        try {
          const result = await runAgentSession({
            uid,
            user_message: lastUserMsg,
            recent_chat: recentChat,
            onPhase: (evt: PhaseEvent) => sse(evt.type, evt),
          });

          // Stream final response en UN chunk (v1 — pas de streaming token-by-token
          // sur l'aggregate. Phase 4b future si latence perçue trop élevée).
          sse('chunk', { text: result.finalResponse });
          sse('done', {
            session_id: result.sessionRecord.session_id,
            cost_estimate_usd: result.sessionRecord.cost_estimate_usd,
            tokens_total: result.sessionRecord.tokens_total,
          });
        } catch (err) {
          console.error('[coach-multi] session failed:', err);
          sse('error', {
            message:
              "Une erreur interne est survenue. Réessaie dans un instant — si ça persiste, contacte le support.",
          });
        } finally {
          try {
            controller.close();
          } catch {
            // already closed
          }
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  });
}
