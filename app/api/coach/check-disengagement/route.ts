/**
 * POST /api/coach/check-disengagement
 *
 * Calcule un signal de décrochage pour l'utilisateur authentifié.
 * Ne déclenche AUCUN message proactif par lui-même — c'est au caller de
 * décider (en POST sur /api/coach/proactive avec trigger=disengaged_detected
 * + le signal en body).
 *
 * Réponse :
 *   {
 *     level: 'none' | 'low' | 'medium' | 'high',
 *     days_since_last_food_log: number | null,
 *     days_since_last_checkin: number | null,
 *     days_since_last_workout: number | null,
 *     days_since_last_user_message: number | null,
 *     adherence_drop_pct: number | null,
 *     signals: string[]
 *   }
 *
 * Use cases :
 *   - Dashboard server component au render : si level≥medium, propose un
 *     bouton "reprendre" ou fire le proactive automatique
 *   - Vercel Cron quotidien : scan + trigger proactive si signal
 *   - Cloud Function périodique : pareil
 *   - Script de test manuel : voir l'état d'engagement d'un user
 *
 * Idempotency : la route ne mute rien. Safe à appeler N fois.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/firebase/auth-middleware';
import { checkRateLimit } from '@/lib/firebase/rate-limit';
import { detectDisengagement } from '@/lib/features/coach-state/disengagement';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  return withAuth(req, async (_authReq, user) => {
    const uid = user.uid;

    const rl = await checkRateLimit(uid, {
      scope: 'coach_check_disengagement',
      perMinute: 10,
      perHour: 100,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'rate_limited', retry_after_sec: rl.retryAfterSec },
        { status: 429 },
      );
    }

    try {
      const signal = await detectDisengagement(uid);
      return NextResponse.json(signal, { status: 200 });
    } catch (err) {
      console.error('[check-disengagement] failed:', err);
      try {
        const Sentry = await import('@sentry/nextjs');
        Sentry.captureException(err, { tags: { route: 'api/coach/check-disengagement' } });
      } catch {
        /* Sentry degrade */
      }
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'unknown_error' },
        { status: 500 },
      );
    }
  });
}
