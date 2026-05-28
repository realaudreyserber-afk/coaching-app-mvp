/**
 * POST /api/coach/sessions/archive
 *
 * Archive la conversation coach courante (users/{uid}/coach_messages) vers une
 * collection DÉDIÉE et consultable : users/{uid}/coach_sessions/{sessionId}
 *   - doc parent RÉEL avec métadonnées (created_at, message_count, preview, title)
 *     → indispensable pour pouvoir LISTER les sessions (l'ancien archivage côté
 *       client n'écrivait qu'une sous-collection sous un parent "fantôme",
 *       donc rien n'était listable).
 *   - sous-collection messages/{originalId} = copie des messages.
 * Puis vide coach_messages.
 *
 * Robustesse : tout passe par l'admin SDK en lots de ≤450 opérations (l'ancien
 * batch client copie+suppression = 2 ops/message dépassait la limite 500 dès
 * ~250 messages → archivage qui échouait silencieusement).
 *
 * Remplace l'ancien handleNewSession client (copie/suppression vers
 * agent_memory_backup, collection partagée avec le système multi-agent).
 */
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { adminDb } from '@/lib/firebase/admin';
import { withAuth } from '@/lib/firebase/auth-middleware';
import { checkRateLimit } from '@/lib/firebase/rate-limit';

export const runtime = 'nodejs';

const CHUNK = 450; // marge sous la limite Firestore de 500 ops/batch

export async function POST(req: NextRequest) {
  return withAuth(req, async (_authReq, user) => {
    const uid = user.uid;

    const rl = await checkRateLimit(uid, { scope: 'coach_archive', perMinute: 4, perHour: 30 });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'rate_limited', retry_after_sec: rl.retryAfterSec },
        { status: 429 },
      );
    }

    const userRef = adminDb.collection('users').doc(uid);
    const messagesSnap = await userRef.collection('coach_messages').get();

    if (messagesSnap.empty) {
      return NextResponse.json({ ok: true, skipped: 'empty' });
    }

    const docs = messagesSnap.docs;
    const now = new Date().toISOString();
    const sessionId = randomUUID();
    const sessionRef = userRef.collection('coach_sessions').doc(sessionId);

    // Métadonnées listables : 1er message utilisateur comme aperçu.
    const firstUser = docs
      .map((d) => d.data())
      .find((m) => m.role === 'user' && typeof m.content === 'string' && m.content.trim());
    const preview = (firstUser?.content as string | undefined)?.trim().slice(0, 140) ?? '';

    try {
      // 1) doc parent RÉEL (métadonnées) — sans lui la session n'est pas listable.
      await sessionRef.set({
        session_id: sessionId,
        created_at: now,
        archived_at: now,
        message_count: docs.length,
        preview,
        title: `Session du ${new Date(now).toLocaleDateString('fr-FR')}`,
        source: 'coach_chat',
      });

      // 2) copie des messages dans la sous-collection, par lots ≤450.
      for (let i = 0; i < docs.length; i += CHUNK) {
        const slice = docs.slice(i, i + CHUNK);
        const batch = adminDb.batch();
        for (const d of slice) {
          batch.set(sessionRef.collection('messages').doc(d.id), d.data());
        }
        await batch.commit();
      }

      // 3) purge de coach_messages, par lots ≤450.
      for (let i = 0; i < docs.length; i += CHUNK) {
        const slice = docs.slice(i, i + CHUNK);
        const batch = adminDb.batch();
        for (const d of slice) {
          batch.delete(d.ref);
        }
        await batch.commit();
      }
    } catch (err) {
      console.error('[coach/sessions/archive] failed:', err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'archive_failed' },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, session_id: sessionId, message_count: docs.length });
  });
}
