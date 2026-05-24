import { NextRequest, NextResponse } from 'next/server';
import { getGoogleFitAuthUrl } from '@/lib/features/wearables/oauth';
import { flags } from '@/lib/features/flags';

export async function GET(req: NextRequest) {
  // Check if wearables feature is active
  if (!flags.wearables()) {
    return NextResponse.json(
      { error: "Ce module n'est pas actif." },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const uid = searchParams.get('uid');

  if (!uid) {
    return NextResponse.json(
      { error: 'Identifiant utilisateur (uid) requis pour le flux OAuth.' },
      { status: 400 }
    );
  }

  const origin = req.nextUrl.origin;
  const redirectUri = `${origin}/api/auth/google-fit/callback`;

  // We pass the uid as the state parameter so we can associate the tokens upon callback
  const authUrl = getGoogleFitAuthUrl(uid, redirectUri);

  return NextResponse.redirect(authUrl);
}
