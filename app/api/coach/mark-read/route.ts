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
import { markInterventionsRead } from '@/lib/features/coach-state/store';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  return withAuth(req, async (_authReq, user) => {
    try {
      await markInterventionsRead(user.uid);
      return NextResponse.json({ ok: true });
    } catch (e) {
      console.error('[mark-read] failed:', e);
      return NextResponse.json({ error: 'internal_error' }, { status: 500 });
    }
  });
}
