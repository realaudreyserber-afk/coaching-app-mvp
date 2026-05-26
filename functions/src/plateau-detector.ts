/**
 * Wave 6 Pile 3 #9 — Plateau detector.
 *
 * Scheduled Cloud Function that runs every Sunday at 10:00 Europe/Paris.
 * For each active user :
 *   1. Read the last 14 days of `users/{uid}/checkins_daily/*`
 *   2. Compute the standard deviation of weight + linear trend slope
 *   3. If stddev < 0.6 kg AND |slope| < 0.05 kg/day → plateau detected
 *   4. Call /api/coach/proactive with trigger=plateau_detected (server-side
 *      HTTP call using ADC-derived ID token for the user — simplified here
 *      via a direct emulation of the route's behaviour against the user's
 *      coach_messages + coach_state).
 *
 * Idempotency : `users/{uid}/coach_state/main.last_plateau_alert_at` is
 * checked — we skip if we already alerted in the last 14 days (avoid
 * weekly nag on the same plateau).
 *
 * Why call the proactive route instead of duplicating its logic ? Because the
 * route already handles Vertex generation + state flip + message persistence
 * in a transaction. Here we use the admin SDK to write a "trigger pending"
 * marker that the next user's /api/ai/coach call will pick up, OR call the
 * proactive route directly via internal HTTP. We choose the latter for
 * symmetry.
 */
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, FieldPath } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { processInChunks } from './lib/parallel';

const PLATEAU_WINDOW_DAYS = 14;
const STDDEV_THRESHOLD_KG = 0.6;
const SLOPE_THRESHOLD_KG_PER_DAY = 0.05;
const MIN_DATAPOINTS = 8;
const RE_ALERT_COOLDOWN_DAYS = 14;

interface CheckinPoint {
  date: string; // YYYY-MM-DD
  weight: number;
  index: number; // day-from-start, used for slope
}

function stddev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Least-squares linear regression slope (kg per day-index).
 * Returns 0 if fewer than 2 points.
 */
function slopeKgPerDay(points: CheckinPoint[]): number {
  if (points.length < 2) return 0;
  const n = points.length;
  const sumX = points.reduce((a, p) => a + p.index, 0);
  const sumY = points.reduce((a, p) => a + p.weight, 0);
  const sumXY = points.reduce((a, p) => a + p.index * p.weight, 0);
  const sumX2 = points.reduce((a, p) => a + p.index * p.index, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return 0;
  return (n * sumXY - sumX * sumY) / denom;
}

async function detectPlateauForUser(
  db: FirebaseFirestore.Firestore,
  uid: string,
): Promise<'alerted' | 'cooldown' | 'no_plateau' | 'no_data' | 'error'> {
  try {
    // H1 fix : query by doc id (YYYY-MM-DD) instead of `created_at` field —
    // legacy checkins written before the field was added get included.
    const cutoffDate = new Date(Date.now() - PLATEAU_WINDOW_DAYS * 24 * 3600 * 1000);
    const cutoffYmd = cutoffDate.toISOString().split('T')[0];

    const snap = await db
      .collection('users')
      .doc(uid)
      .collection('checkins_daily')
      .orderBy(FieldPath.documentId(), 'asc')
      .startAt(cutoffYmd)
      .get();

    const points: CheckinPoint[] = [];
    snap.forEach((d) => {
      const data = d.data();
      const w = typeof data.weight === 'number' ? data.weight : null;
      if (w !== null) {
        points.push({ date: d.id, weight: w, index: points.length });
      }
    });

    if (points.length < MIN_DATAPOINTS) return 'no_data';

    const weights = points.map((p) => p.weight);
    const sd = stddev(weights);
    const slope = Math.abs(slopeKgPerDay(points));

    if (sd >= STDDEV_THRESHOLD_KG || slope >= SLOPE_THRESHOLD_KG_PER_DAY) {
      return 'no_plateau';
    }

    // Plateau detected — single transaction reads coach_state inside the
    // tx (H3 fix : was reading outside the tx before, opening a race window
    // with /api/coach/proactive and mark-read writes).
    const stateRef = db.collection('users').doc(uid).collection('coach_state').doc('main');
    const messageRef = db
      .collection('users')
      .doc(uid)
      .collection('coach_messages')
      .doc();
    const now = new Date().toISOString();

    return await db.runTransaction(async (tx) => {
      const stateSnap = await tx.get(stateRef);
      const lastAlertIso = stateSnap.data()?.last_plateau_alert_at as string | undefined;
      if (lastAlertIso) {
        const lastAlertMs = new Date(lastAlertIso).getTime();
        const cooldownMs = RE_ALERT_COOLDOWN_DAYS * 24 * 3600 * 1000;
        if (Date.now() - lastAlertMs < cooldownMs) return 'cooldown';
      }

      tx.set(messageRef, {
        role: 'assistant',
        content:
          'Ton poids stagne depuis 14 jours. Pas de panique — c\'est le moment de revoir 1 hypothèse : ' +
          'déficit insuffisant (recompter macros sur 3j), sommeil dégradé (récup hormonale), ' +
          'ou surévaluation de l\'activité (TDEE adaptatif). Ouvre le chat et dis-moi ce qui colle, ' +
          'on recalibre.',
        timestamp: now,
        proactive: true,
        trigger: 'plateau_detected',
      });
      const statePatch: Record<string, unknown> = {
        last_intervention_at: now,
        has_unread_intervention: true,
        last_plateau_alert_at: now,
        updated_at: now,
      };
      if (!stateSnap.exists) {
        Object.assign(statePatch, {
          welcome_sent: false,
          plan_debrief_sent: false,
          topics_discussed: [],
          pending_followups: [],
          response_style: 'mixed',
          created_at: now,
        });
      }
      tx.set(stateRef, statePatch, { merge: true });
      return 'alerted';
    });
  } catch (err) {
    logger.error(`plateau detect failed for ${uid}:`, err);
    return 'error';
  }
}

export const plateauDetector = onSchedule(
  {
    // Run every Sunday at 10:00 Europe/Paris — gives users a calm
    // morning briefing rather than a notification during work hours.
    schedule: 'every sunday 10:00',
    timeZone: 'Europe/Paris',
    region: 'europe-west1',
    memory: '512MiB',
    timeoutSeconds: 540,
  },
  async () => {
    const db = getFirestore();
    const usersSnap = await db.collection('users').get();

    const results = await processInChunks(usersSnap.docs, 20, async (userDoc) => {
      return detectPlateauForUser(db, userDoc.id);
    });

    const counts = results.reduce<Record<string, number>>((acc, r) => {
      acc[r] = (acc[r] ?? 0) + 1;
      return acc;
    }, {});
    logger.info('plateau detector result:', counts);
  },
);
