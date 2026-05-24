/**
 * M18 — Daily marker of streaks at risk.
 *
 * Runs at 18h Europe/Paris. Users with streak ≥ 7 days AND no check-in today
 * yet get `at_risk: true`, picked up by smart-notifications-cron 19h-20h.
 */
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { processInChunks } from './lib/parallel';

export const streakRiskMarker = onSchedule(
  {
    schedule: 'every day 18:00',
    timeZone: 'Europe/Paris',
    region: 'europe-west1',
    memory: '256MiB',
  },
  async () => {
    const db = getFirestore();
    const todayStr = new Date().toISOString().split('T')[0];
    const usersSnap = await db.collection('users').get();

    const results = await processInChunks(usersSnap.docs, 25, async (userDoc) => {
      try {
        const uid = userDoc.id;
        const streakRef = db.collection('users').doc(uid).collection('streak').doc('current');
        const streakSnap = await streakRef.get();
        if (!streakSnap.exists) return false;

        const data = streakSnap.data() || {};
        const value: number = data.value || 0;
        const lastDate: string | undefined = data.last_checkin_date;

        if (value < 7) return false;
        if (lastDate === todayStr) return false; // already checked in today

        await streakRef.update({
          at_risk: true,
          at_risk_marked_at: new Date().toISOString(),
        });
        return true;
      } catch (err) {
        logger.error(`Streak risk marker failed for ${userDoc.id}:`, err);
        return false;
      }
    });

    const marked = results.filter(Boolean).length;
    logger.info(`Streak at-risk marker: ${marked} users flagged`);
  }
);
