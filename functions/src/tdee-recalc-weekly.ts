import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { processInChunks } from './lib/parallel';

const KCAL_PER_KG_FAT = 7700;

function linearRegressionSlope(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

export const tdeeRecalcWeekly = onSchedule(
  {
    schedule: 'every monday 06:00',
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

        if (checkinsSnap.size < 10) return false;

        const data = checkinsSnap.docs
          .map(d => d.data())
          .filter(d => typeof d.weight === 'number' && typeof d.kcal_ingested === 'number')
          .reverse();

        if (data.length < 10) return false;

        const xs = data.map((_, i) => i);
        const weights = data.map(d => d.weight as number);
        const kcal = data.map(d => d.kcal_ingested as number);

        const weightSlopeKgPerDay = linearRegressionSlope(xs, weights);
        const energyImbalanceKcalPerDay = weightSlopeKgPerDay * KCAL_PER_KG_FAT;
        const meanKcalIngested = kcal.reduce((a, b) => a + b, 0) / kcal.length;
        const estimatedTdee = Math.round(meanKcalIngested - energyImbalanceKcalPerDay);

        if (estimatedTdee > 1200 && estimatedTdee < 5000) {
          const nowIso = new Date().toISOString();
          const weekKey = (() => {
            const d = new Date();
            const onejan = new Date(d.getFullYear(), 0, 1);
            const week = Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
            return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
          })();

          await db.collection('users').doc(uid).update({
            'profile.tdee_adaptive': estimatedTdee,
            'profile.tdee_adaptive_updated_at': nowIso,
          });

          // Append to history sub-collection (ADR-006: time-series → sub-collection)
          await db
            .collection('users').doc(uid)
            .collection('tdee_history').doc(weekKey)
            .set({
              week: weekKey,
              tdee_adaptive: estimatedTdee,
              weight_slope_kg_per_day: Math.round(weightSlopeKgPerDay * 10000) / 10000,
              mean_kcal_ingested: Math.round(meanKcalIngested),
              datapoints_used: data.length,
              computed_at: nowIso,
            });

          return true;
        }
        return false;
      } catch (err) {
        logger.error(`TDEE recalc failed for ${userDoc.id}:`, err);
        return false;
      }
    });

    const updated = results.filter(Boolean).length;
    logger.info(`TDEE adaptive updated for ${updated} users.`);
  }
);
