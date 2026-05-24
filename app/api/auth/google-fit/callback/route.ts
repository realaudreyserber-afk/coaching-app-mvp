import { NextRequest, NextResponse } from 'next/server';
import { exchangeGoogleFitCode } from '@/lib/features/wearables/oauth';
import { adminDb } from '@/lib/firebase/admin';
import { flags } from '@/lib/features/flags';

export async function GET(req: NextRequest) {
  // Check if active
  if (!flags.wearables()) {
    const origin = req.nextUrl.origin;
    return NextResponse.redirect(`${origin}/dashboard`);
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const uid = searchParams.get('state'); // The uid is passed as the state param
  const origin = req.nextUrl.origin;

  if (!code || !uid) {
    console.error('Google Fit callback error: Missing code or state/uid.');
    return NextResponse.redirect(`${origin}/settings/connections?error=missing_params`);
  }

  try {
    const redirectUri = `${origin}/api/auth/google-fit/callback`;
    const tokens = await exchangeGoogleFitCode(code, redirectUri);

    // ADR-006: tokens stored in nested map users/{uid}.wearable.google_fit
    // (one-shot config, not append-only → map, not sub-collection)
    await adminDb.collection('users').doc(uid).update({
      'wearable.google_fit': {
        connected: true,
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        expires_at: tokens.expiresAt,
        updated_at: new Date().toISOString(),
      },
      'profile.wearables_connected': true,
      'profile.wearables_source': 'google_fit',
    });

    return NextResponse.redirect(`${origin}/settings/connections?success=true`);
  } catch (error) {
    console.error('Error in Google Fit callback handler:', error);
    return NextResponse.redirect(`${origin}/settings/connections?error=auth_failed`);
  }
}
