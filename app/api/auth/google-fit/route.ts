import { NextRequest, NextResponse } from 'next/server';
import { getGoogleFitAuthUrl } from '@/lib/features/wearables/oauth';
import { flags } from '@/lib/features/flags';
import { adminAuth } from '@/lib/firebase/admin';

/**
 * Wave 12 — Read uid from the httpOnly `__session` cookie (Firebase
 * session cookie) instead of a `?uid=` query param. Previous behavior
 * leaked the uid in server logs and browser history, and was spoofable —
 * an attacker could craft `/api/auth/google-fit?uid=VICTIM_UID` and start
 * an OAuth flow that would link THEIR Google account to VICTIM's profile.
 *
 * The session cookie is httpOnly + sameSite=lax, set by /api/auth/session
 * after every successful login.
 */
export async function GET(req: NextRequest) {
  // Check if wearables feature is active
  if (!flags.wearables()) {
    return NextResponse.json(
      { error: "Ce module n'est pas actif." },
      { status: 403 }
    );
  }

  const sessionCookie = req.cookies.get('__session')?.value;
  if (!sessionCookie) {
    return NextResponse.json(
      { error: 'Session expirée — reconnecte-toi avant de lier Google Fit.' },
      { status: 401 }
    );
  }

  let uid: string;
  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    uid = decoded.uid;
  } catch {
    return NextResponse.json(
      { error: 'Session invalide. Reconnecte-toi.' },
      { status: 401 }
    );
  }

  const origin = req.nextUrl.origin;
  const redirectUri = `${origin}/api/auth/google-fit/callback`;

  // We pass the uid as the state parameter so the callback can associate
  // the granted tokens to the right user. This is now safe: the uid was
  // derived server-side from an authenticated session, not from the URL.
  const authUrl = getGoogleFitAuthUrl(uid, redirectUri);

  return NextResponse.redirect(authUrl);
}
