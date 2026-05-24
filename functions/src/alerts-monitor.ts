import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { processInChunks } from './lib/parallel';

const MAX_LOSS_PCT_PER_WEEK = 0.015;
const CONSECUTIVE_WEEKS_THRESHOLD = 3;

export const alertsMonitor = onSchedule(
  {
    schedule: 'every day 05:00',
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
          .limit(28)
          .get();

        const weights = checkinsSnap.docs
          .map(d => ({ date: d.data().date as string, weight: d.data().weight as number }))
          .filter(d => typeof d.weight === 'number')
          .reverse();

        if (weights.length < 21) return false;

        let consecutiveExceedingWeeks = 0;
        for (let i = weights.length - 1; i >= 7; i -= 7) {
          const current = weights[i].weight;
          const previous = weights[i - 7].weight;
          const lossPct = (previous - current) / previous;
          if (lossPct > MAX_LOSS_PCT_PER_WEEK) {
            consecutiveExceedingWeeks++;
          } else {
            break;
          }
        }

        if (consecutiveExceedingWeeks >= CONSECUTIVE_WEEKS_THRESHOLD) {
          await db.collection('users').doc(uid).collection('alerts').add({
            type: 'EXTREME_LOSS',
            severity: 'critical',
            triggered_at: FieldValue.serverTimestamp(),
            resolved: false,
            message: `Perte > 1.5%/semaine sur ${consecutiveExceedingWeeks} semaines consécutives. Consultation médicale fortement recommandée.`,
            action_taken: null,
          });
          return true;
        }
        return false;
      } catch (err) {
        logger.error(`Alerts monitor failed for ${userDoc.id}:`, err);
        return false;
      }
    });

    const alertsRaised = results.filter(Boolean).length;
    logger.info(`Alerts monitor raised ${alertsRaised} extreme loss alerts.`);
  }
);
