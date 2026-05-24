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

    // Save tokens in Firestore securely via admin SDK
    await adminDb
      .collection('users')
      .doc(uid)
      .collection('tokens')
      .doc('google-fit')
      .set({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        updatedAt: new Date().toISOString(),
      });

    // Update user profile status
    await adminDb.collection('users').doc(uid).update({
      'profile.wearables_connected': true,
      'profile.wearables_source': 'google-fit',
    });

    return NextResponse.redirect(`${origin}/settings/connections?success=true`);
  } catch (error) {
    console.error('Error in Google Fit callback handler:', error);
    return NextResponse.redirect(`${origin}/settings/connections?error=auth_failed`);
  }
}
