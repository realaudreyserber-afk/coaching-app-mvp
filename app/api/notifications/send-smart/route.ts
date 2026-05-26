import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/firebase/auth-middleware';
import { checkRateLimit } from '@/lib/firebase/rate-limit';
import { adminDb, adminMessaging } from '@/lib/firebase/admin';
import { generateSmartNotification } from '@/lib/features/smart-notifs/generator';
import { flags } from '@/lib/features/flags';

export async function POST(req: NextRequest) {
  if (!flags.smartNotifs()) {
    return NextResponse.json(
      { error: "Ce module n'est pas actif." },
      { status: 403 }
    );
  }

  return withAuth(req, async (authenticatedReq, user) => {
    // Wave 13C — Cap notif spam. Each call = Vertex generation + FCM
    // multicast. 10/h is generous and protects against trigger loops.
    const rl = await checkRateLimit(user.uid, { scope: 'notif_smart', perHour: 10 });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'rate_limited', retry_after_sec: rl.retryAfterSec },
        { status: 429 },
      );
    }
    try {
      const { context } = await req.json().catch(() => ({ context: 'missing_checkin' }));

      // Fetch user data
      const userRef = adminDb.collection('users').doc(user.uid);
      const userSnap = await userRef.get();

      if (!userSnap.exists) {
        return NextResponse.json(
          { error: 'Profil utilisateur introuvable.' },
          { status: 404 }
        );
      }

      const userData = userSnap.data() || {};
      const name = userData.profile?.name || "Athlète";
      const fcmTokens: string[] = userData.fcmTokens || [];

      // Generate notification content with Gemini Flash
      const notificationContent = await generateSmartNotification(
        name,
        context as 'missing_checkin' | 'fasting_reminder' | 'weight_milestone' | 'general_motivation'
      );

      // If user has active FCM subscription tokens, send them
      let sentCount = 0;
      if (fcmTokens.length > 0) {
        try {
          const multicastMessage = {
            notification: {
              title: notificationContent.title,
              body: notificationContent.body,
            },
            tokens: fcmTokens,
          };
          
          // Send notification
          const response = await adminMessaging.sendEachForMulticast(multicastMessage);
          sentCount = response.successCount;
        } catch (fcmError) {
          console.error("FCM transmission failed, returning generated text only:", fcmError);
        }
      }

      return NextResponse.json({
        success: true,
        message: notificationContent,
        sentCount,
        tokensTargeted: fcmTokens.length,
      }, { status: 200 });

    } catch (error) {
      console.error('Error in smart notification API:', error);
      const errMsg = error instanceof Error ? error.message : String(error);
      return NextResponse.json(
        { error: 'Impossible de générer la notification intelligente.', details: errMsg },
        { status: 500 }
      );
    }
  });
}
