/**
 * POST /api/coach/mark-read
 *
 * Clears coach_state.has_unread_intervention. Called when the user opens
 * /coach so the dashboard badge disappears.
 *
 * No body required.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/firebase/auth-middleware';
import { checkRateLimit } from '@/lib/firebase/rate-limit';
import { markInterventionsRead } from '@/lib/features/coach-state/store';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  return withAuth(req, async (_authReq, user) => {
    // M1 fix : was unprotected, trivially spammable.
    const rl = await checkRateLimit(user.uid, {
      scope: 'coach_mark_read',
      perMinute: 30,
      perHour: 200,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'rate_limited', retry_after_sec: rl.retryAfterSec },
        { status: 429 },
      );
    }
    try {
      await markInterventionsRead(user.uid);
      return NextResponse.json({ ok: true });
    } catch (e) {
      console.error('[mark-read] failed:', e);
      return NextResponse.json({ error: 'internal_error' }, { status: 500 });
    }
  });
}
