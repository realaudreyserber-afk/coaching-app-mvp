import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { logger } from 'firebase-functions';
import { processInChunks } from './lib/parallel';

interface NotifContext {
  uid: string;
  fcmToken: string;
  hasCheckinToday: boolean;
  hasMicroTaskToday: boolean;
  inFastingWindow: boolean;
  recentPlateau: boolean;
}

export const smartNotificationsCron = onSchedule(
  {
    schedule: 'every 1 hours',
    timeZone: 'Europe/Paris',
    region: 'europe-west1',
    memory: '512MiB',
  },
  async () => {
    const db = getFirestore();
    const messaging = getMessaging();
    const usersSnap = await db.collection('users').get();
    const todayStr = new Date().toISOString().split('T')[0];

    const results = await processInChunks(usersSnap.docs, 25, async (userDoc) => {
      try {
        const data = userDoc.data();
        if (!data.settings?.notifications) return false;
        const fcmToken = data.fcm_token;
        if (!fcmToken) return false;

        const ctx: NotifContext = {
          uid: userDoc.id,
          fcmToken,
          hasCheckinToday: false,
          hasMicroTaskToday: false,
          inFastingWindow: false,
          recentPlateau: false,
        };

        const checkinSnap = await db
          .collection('users').doc(userDoc.id)
          .collection('checkins_daily').doc(todayStr).get();
        ctx.hasCheckinToday = checkinSnap.exists;

        const hour = new Date().getHours();
        if (!ctx.hasCheckinToday && hour === 20) {
          await messaging.send({
            token: fcmToken,
            notification: {
              title: 'Ton check-in du jour',
              body: '30 secondes pour logger ton poids et ton ressenti.',
            },
            webpush: { fcmOptions: { link: '/checkin/daily' } },
          });
          return true;
        }
        return false;
      } catch (err) {
        logger.error(`Smart notif failed for ${userDoc.id}:`, err);
        return false;
      }
    });

    const notified = results.filter(Boolean).length;
    logger.info(`Smart notifications sent: ${notified}`);
  }
);
