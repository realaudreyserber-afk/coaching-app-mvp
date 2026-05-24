import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { processInChunks } from './lib/parallel';

const RETENTION_DAYS = 30;

export const stripeEventsCleanup = onSchedule(
  {
    schedule: 'every day 02:00',
    timeZone: 'Europe/Paris',
    region: 'europe-west1',
    memory: '256MiB',
    timeoutSeconds: 540,
  },
  async () => {
    const db = getFirestore();
    const cutoffMs = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const cutoffIso = new Date(cutoffMs).toISOString();

    const snap = await db
      .collection('_stripe_events')
      .where('received_at', '<', cutoffIso)
      .limit(2000)
      .get();

    if (snap.empty) {
      logger.info('No stripe events to purge.');
      return;
    }

    const deleted = await processInChunks(snap.docs, 50, async (doc) => {
      await doc.ref.delete();
      return true;
    });

    logger.info(`Purged ${deleted.length} stripe events older than ${RETENTION_DAYS}d.`);
  }
);
