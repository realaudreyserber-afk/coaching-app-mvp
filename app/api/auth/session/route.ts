import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    const { idToken } = await req.json();
    if (!idToken || typeof idToken !== 'string') {
      return NextResponse.json({ error: 'idToken manquant.' }, { status: 400 });
    }

    const isMockEnabled =
      process.env.ENABLE_MOCK_AUTH === '1' &&
      (process.env.NODE_ENV as string) !== 'production';

    if (
      isMockEnabled &&
      (idToken === 'mock-token' ||
        idToken === 'mock-token-non-admin' ||
        idToken === 'mock-token-no-profile')
    ) {
      const res = NextResponse.json({ success: true });
      res.cookies.set('__session', idToken, {
        maxAge: FIVE_DAYS_MS / 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      });
      return res;
    }

    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: FIVE_DAYS_MS,
    });

    const res = NextResponse.json({ success: true });
    res.cookies.set('__session', sessionCookie, {
      maxAge: FIVE_DAYS_MS / 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
    return res;
  } catch (err) {
    console.error('Session creation failed:', err);
    return NextResponse.json({ error: 'Impossible de créer la session.' }, { status: 401 });
  }
}

export async function DELETE(req: NextRequest) {
  const cookie = req.cookies.get('__session')?.value;
  if (cookie) {
    try {
      const decoded = await adminAuth.verifySessionCookie(cookie, false);
      await adminAuth.revokeRefreshTokens(decoded.uid);
    } catch {
      // Cookie invalide ou déjà expiré — on continue à le supprimer.
    }
  }
  const res = NextResponse.json({ success: true });
  res.cookies.set('__session', '', { maxAge: 0, path: '/' });
  return res;
}
