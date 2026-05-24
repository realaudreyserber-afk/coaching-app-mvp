import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { processInChunks } from './lib/parallel';

interface FitDataPoint {
  startTimeMillis: string;
  endTimeMillis: string;
  dataset: Array<{
    point: Array<{
      value: Array<{ intVal?: number; fpVal?: number }>;
    }>;
  }>;
}

async function fetchGoogleFitDataset(accessToken: string, datasourceId: string, startMs: number, endMs: number): Promise<FitDataPoint | null> {
  const url = `https://www.googleapis.com/fitness/v1/users/me/dataSources/${datasourceId}/datasets/${startMs}000000-${endMs}000000`;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    logger.warn(`Google Fit fetch failed for ${datasourceId}:`, err);
    return null;
  }
}

export const wearableSyncNightly = onSchedule(
  {
    schedule: 'every day 03:00',
    timeZone: 'Europe/Paris',
    region: 'europe-west1',
    memory: '512MiB',
    timeoutSeconds: 540,
  },
  async () => {
    const db = getFirestore();
    const usersSnap = await db
      .collection('users')
      .where('wearable.google_fit.connected', '==', true)
      .get();

    const now = Date.now();
    const startMs = now - 24 * 60 * 60 * 1000;
    const dateStr = new Date(startMs).toISOString().split('T')[0];

    const results = await processInChunks(usersSnap.docs, 25, async (userDoc) => {
      try {
        const uid = userDoc.id;
        const accessToken = userDoc.data().wearable?.google_fit?.access_token;
        if (!accessToken) return false;

        const steps = await fetchGoogleFitDataset(
          accessToken,
          'derived:com.google.step_count.delta:com.google.android.gms:estimated_steps',
          startMs, now
        );

        await db.collection('users').doc(uid)
          .collection('wearable_sync').doc(dateStr)
          .set({
            source: 'google_fit',
            synced_at: new Date().toISOString(),
            steps_raw: steps ?? null,
          }, { merge: true });

        return true;
      } catch (err) {
        logger.error(`Wearable sync failed for ${userDoc.id}:`, err);
        return false;
      }
    });

    const synced = results.filter(Boolean).length;
    logger.info(`Wearable sync nightly: ${synced} users.`);
  }
);
