/**
 * Phase 7 data-layer — Photos de progression.
 *
 * Réutilise la collection existante `users/{uid}/photos/{photoId}`
 * (peuplée par /api/ai/analyze-photo). Ce module n'ajoute pas de collection,
 * il sert juste de couche d'accès pour les agents et la page gallery.
 *
 * Le snapshot retourné aux agents est volontairement limité : juste count
 * + date du dernier + signal "à refaire" si > 4 semaines.
 */

import 'server-only';
import { adminDb } from '@/lib/firebase/admin';

interface PhotoDoc {
  date?: string;
  type?: string;
  storage_path?: string;
  bf_estimated?: number;
  quality_score?: number;
  created_at?: string;
}

export interface ProgressPhotosSnapshot {
  total_count: number;
  /** Date YYYY-MM-DD de la photo la plus récente (null si aucune) */
  last_photo_date: string | null;
  /** Jours depuis la dernière photo (null si aucune) */
  days_since_last: number | null;
  /** BF estimé sur la dernière photo (si analyse OK) */
  last_bf_estimated: number | null;
  /** Compteur par type (face / body / etc.) */
  by_type: Record<string, number>;
  /** Si > 28j depuis dernière photo, suggérer d'en refaire une */
  should_suggest_new: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export async function getProgressPhotosSnapshot(
  uid: string,
): Promise<ProgressPhotosSnapshot | null> {
  try {
    const snap = await adminDb
      .collection('users')
      .doc(uid)
      .collection('photos')
      .orderBy('date', 'desc')
      .limit(60)
      .get();
    if (snap.empty) return null;

    const docs: PhotoDoc[] = snap.docs.map((d) => d.data() as PhotoDoc);
    const byType: Record<string, number> = {};
    let lastDate: string | null = null;
    let lastBf: number | null = null;

    for (const d of docs) {
      const t = d.type ?? 'unknown';
      byType[t] = (byType[t] ?? 0) + 1;
      if (d.date && (!lastDate || d.date > lastDate)) {
        lastDate = d.date;
        if (typeof d.bf_estimated === 'number') lastBf = d.bf_estimated;
      }
    }

    const daysSince =
      lastDate !== null
        ? Math.floor((Date.now() - new Date(lastDate).getTime()) / DAY_MS)
        : null;

    return {
      total_count: docs.length,
      last_photo_date: lastDate,
      days_since_last: daysSince,
      last_bf_estimated: lastBf,
      by_type: byType,
      should_suggest_new: daysSince !== null && daysSince > 28,
    };
  } catch (e) {
    console.warn('[progress-photos/store] snapshot failed:', e);
    return null;
  }
}
