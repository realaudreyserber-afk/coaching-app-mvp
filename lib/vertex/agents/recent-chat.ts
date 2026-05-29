/**
 * buildRecentChat — construit la fenêtre recent_chat passée au supervisor.
 *
 * Source unique : avant (audit 2026-05-29), la même logique
 * (slice(0,-1).slice(-N) + normalisation des rôles + filtre des vides) était
 * dupliquée dans coach-route-adapter.ts ET dans la route /api/ai/coach-multi,
 * avec un risque de divergence (l'une passe à 8 messages, pas l'autre).
 */

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export function buildRecentChat(
  messages: Array<{ role?: string; content?: string }>,
  limit = 6,
): ChatTurn[] {
  return messages
    .slice(0, -1) // exclut le message courant
    .slice(-limit)
    .map((m) => ({
      role:
        m.role === 'assistant' || m.role === 'model'
          ? ('assistant' as const)
          : ('user' as const),
      content: typeof m.content === 'string' ? m.content : '',
    }))
    .filter((m) => m.content.length > 0);
}
