import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';

/**
 * M18 streak — proper reset/increment logic:
 *   - If yesterday had a check-in → increment current
 *   - If gap > 1 day → reset to 1
 *   - Track `longest` (all-time max)
 *   - `last_checkin_date` for at_risk computation by smart-notifs cron
 */
function yesterdayStr(today: string): string {
  const d = new Date(today + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().split('T')[0];
}

export const onCheckinWrite = onDocumentWritten(
  {
    document: 'users/{uid}/checkins_daily/{date}',
    region: 'europe-west1',
  },
  async (event) => {
    const uid = event.params.uid;
    const date = event.params.date as string;
    const newData = event.data?.after.data();
    if (!newData) return;

    const db = getFirestore();
    const userRef = db.collection('users').doc(uid);

    try {
      const streakRef = userRef.collection('streak').doc('current');
      const streakSnap = await streakRef.get();
      const prevValue = streakSnap.exists ? (streakSnap.data()?.value || 0) : 0;
      const prevLongest = streakSnap.exists ? (streakSnap.data()?.longest || 0) : 0;
      const prevLastDate = streakSnap.exists ? (streakSnap.data()?.last_checkin_date as string | undefined) : undefined;

      const expected = yesterdayStr(date);
      const newValue = prevLastDate === expected || prevLastDate === date ? prevValue + 1 : 1;
      const newLongest = Math.max(prevLongest, newValue);

      await streakRef.set(
        {
          value: newValue,
          longest: newLongest,
          last_checkin_date: date,
          at_risk: false,
          updated_at: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // Low mood alert (7+ consecutive days < 4/10)
      const recentSnap = await userRef
        .collection('checkins_daily')
        .orderBy('date', 'desc')
        .limit(8)
        .get();
      const moodScores = recentSnap.docs
        .map((d) => d.data().mood)
        .filter((m): m is number => typeof m === 'number');

      if (moodScores.length >= 7) {
        const lowMoodDays = moodScores.filter((m) => m < 4).length;
        if (lowMoodDays >= 7) {
          await userRef.collection('alerts').add({
            type: 'LOW_MOOD_STREAK',
            severity: 'high',
            triggered_at: FieldValue.serverTimestamp(),
            resolved: false,
            message: "Score d'humeur < 4/10 sur 7 jours consécutifs — orientation soutien psychologique recommandée.",
            action_taken: null,
          });
          logger.warn(`Low mood alert raised for user ${uid}`);
        }
      }
    } catch (err) {
      logger.error(`on-checkin-write failed for ${uid}:`, err);
    }
  }
);
