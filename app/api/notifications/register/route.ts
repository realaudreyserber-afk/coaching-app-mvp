import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/firebase/auth-middleware';
import { adminDb, adminFieldValue } from '@/lib/firebase/admin';
import { FcmTokenRegistrationSchema } from '@/lib/features/smart-notifs/schema';
import { flags } from '@/lib/features/flags';

export async function POST(req: NextRequest) {
  if (!flags.smartNotifs()) {
    return NextResponse.json(
      { error: "Ce module n'est pas actif." },
      { status: 403 }
    );
  }

  return withAuth(req, async (authenticatedReq, user) => {
    try {
      const { token } = await req.json();

      // Validate with schema
      FcmTokenRegistrationSchema.parse({ token });

      // Save token in the user's profile document under fcmTokens array
      await adminDb.collection('users').doc(user.uid).update({
        fcmTokens: adminFieldValue.arrayUnion(token),
        updatedAt: new Date().toISOString(),
      });

      return NextResponse.json({
        success: true,
        message: "Jeton FCM enregistré avec succès.",
      }, { status: 200 });

    } catch (error) {
      console.error('Error registering FCM token:', error);
      const errMsg = error instanceof Error ? error.message : String(error);
      return NextResponse.json(
        { error: 'Impossible d\'enregistrer le jeton de notification.', details: errMsg },
        { status: 500 }
      );
    }
  });
}
