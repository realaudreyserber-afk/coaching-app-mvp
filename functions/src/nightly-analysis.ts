import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { processInChunks } from './lib/parallel';

export const nightlyAnalysis = onSchedule(
  {
    schedule: 'every day 04:00',
    timeZone: 'Europe/Paris',
    region: 'europe-west1',
    memory: '512MiB',
    timeoutSeconds: 540,
  },
  async () => {
    const db = getFirestore();
    const usersSnap = await db.collection('users').get();

    const results = await processInChunks(usersSnap.docs, 25, async (userDoc) => {
      try {
        const uid = userDoc.id;
        const checkinsSnap = await db
          .collection('users').doc(uid)
          .collection('checkins_daily')
          .orderBy('date', 'desc')
          .limit(14)
          .get();

        if (checkinsSnap.empty) return false;

        const weights = checkinsSnap.docs
          .map(d => d.data().weight)
          .filter((w): w is number => typeof w === 'number');

        if (weights.length < 7) return false;

        const avg7 = weights.slice(0, 7).reduce((a, b) => a + b, 0) / 7;
        const avg14 = weights.reduce((a, b) => a + b, 0) / weights.length;

        await db.collection('users').doc(uid).update({
          'analytics.weight_avg_7d': Math.round(avg7 * 10) / 10,
          'analytics.weight_avg_14d': Math.round(avg14 * 10) / 10,
          'analytics.last_nightly_run': new Date().toISOString(),
        });
        return true;
      } catch (err) {
        logger.error(`Nightly analysis failed for user ${userDoc.id}:`, err);
        return false;
      }
    });

    const processed = results.filter(Boolean).length;
    logger.info(`Nightly analysis processed ${processed}/${usersSnap.size} users.`);
  }
);
