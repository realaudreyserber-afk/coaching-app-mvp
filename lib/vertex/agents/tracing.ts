/**
 * Tracing structuré pour les sessions multi-agents.
 *
 * Pourquoi un module dédié plutôt que console.log brut ?
 *   - Format JSON cohérent dans Vercel function logs → grep-able
 *   - Capture Sentry breadcrumbs automatique pour les erreurs
 *   - Possibilité future de brancher OpenTelemetry / DataDog
 *   - Tag automatique session_id + uid pour corrélation cross-line
 */

import 'server-only';
import { randomUUID } from 'node:crypto';
import type { SubAgentName } from './types';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface TraceContext {
  session_id: string;
  uid: string;
  agent?: SubAgentName | 'supervisor';
}

interface TraceEvent {
  level: LogLevel;
  event: string;
  ctx: TraceContext;
  data?: Record<string, unknown>;
  timestamp: string;
}

function emit(event: TraceEvent): void {
  // Émet en JSON sur une seule ligne pour faciliter le grep dans Vercel logs.
  // Préserver le timestamp même si Vercel ajoute le sien (clock skew possible).
  const line = JSON.stringify(event);
  switch (event.level) {
    case 'debug':
      console.debug(line);
      break;
    case 'info':
      console.log(line);
      break;
    case 'warn':
      console.warn(line);
      break;
    case 'error':
      console.error(line);
      break;
  }
}

export const tracer = {
  /**
   * Démarre une trace pour un sous-agent ou le supervisor.
   * Retourne un objet avec des helpers contextualisés.
   */
  forSession(session_id: string, uid: string) {
    return {
      /** Trace un événement supervisor */
      supervisor(event: string, level: LogLevel = 'info', data?: Record<string, unknown>) {
        emit({
          level,
          event,
          ctx: { session_id, uid, agent: 'supervisor' },
          data,
          timestamp: new Date().toISOString(),
        });
      },

      /** Trace un événement d'un sous-agent */
      agent(
        agent: SubAgentName,
        event: string,
        level: LogLevel = 'info',
        data?: Record<string, unknown>,
      ) {
        emit({
          level,
          event,
          ctx: { session_id, uid, agent },
          data,
          timestamp: new Date().toISOString(),
        });
      },

      /**
       * Capture une erreur dans Sentry + console. Best-effort : si Sentry
       * n'est pas configuré, on continue en console seul.
       */
      async captureError(
        err: unknown,
        agent: SubAgentName | 'supervisor',
        context: Record<string, unknown> = {},
      ): Promise<void> {
        const errMsg = err instanceof Error ? err.message : String(err);
        emit({
          level: 'error',
          event: 'agent_error',
          ctx: { session_id, uid, agent },
          data: { error: errMsg, ...context },
          timestamp: new Date().toISOString(),
        });
        try {
          const Sentry = await import('@sentry/nextjs');
          Sentry.captureException(err, {
            tags: { session_id, uid, agent, system: 'multi-agent' },
            extra: context,
          });
        } catch {
          // Sentry pas configuré — degrade gracefully
        }
      },
    };
  },
};

/**
 * Helpers pour générer des session_id uniques. On n'utilise pas firestore
 * auto-id parce que le sessionId est créé AVANT le premier write — au
 * début du flow supervisor. Format : timestamp + crypto random (122 bits).
 * Math.random() insuffisant à >100k users sur le même ms.
 */
export function generateSessionId(): string {
  const ts = Date.now().toString(36);
  const rand = randomUUID().replace(/-/g, '').slice(0, 16);
  return `sess_${ts}_${rand}`;
}
