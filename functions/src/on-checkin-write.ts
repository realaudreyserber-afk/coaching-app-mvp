import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';

export const onCheckinWrite = onDocumentWritten(
  {
    document: 'users/{uid}/checkins_daily/{date}',
    region: 'europe-west1',
  },
  async (event) => {
    const uid = event.params.uid;
    const newData = event.data?.after.data();
    if (!newData) return;

    const db = getFirestore();
    const userRef = db.collection('users').doc(uid);

    try {
      const recentSnap = await userRef
        .collection('checkins_daily')
        .orderBy('date', 'desc')
        .limit(8)
        .get();

      const dailyDocs = recentSnap.docs.map(d => d.data());
      const hasDoneToday = dailyDocs.length > 0;

      if (hasDoneToday) {
        const streakRef = userRef.collection('streak').doc('current');
        const streakSnap = await streakRef.get();
        const currentStreak = streakSnap.exists ? (streakSnap.data()?.value || 0) : 0;
        await streakRef.set({
          value: currentStreak + 1,
          updated_at: FieldValue.serverTimestamp(),
        }, { merge: true });
      }

      const moodScores = dailyDocs
        .map(d => d.mood)
        .filter((m): m is number => typeof m === 'number');

      if (moodScores.length >= 7) {
        const lowMoodDays = moodScores.filter(m => m < 4).length;
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
