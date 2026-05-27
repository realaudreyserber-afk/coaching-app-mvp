/**
 * Détection de décrochage utilisateur.
 *
 * Lit plusieurs signaux Firestore (food_logs, checkins_daily, workout_sessions,
 * coach_messages user-initiated) pour estimer si l'user est en train de
 * désengager. Renvoie un niveau structuré + raisons.
 *
 * Réutilisable depuis :
 *   - /api/coach/check-disengagement (endpoint manuel ou cron)
 *   - Dashboard server component (au render, vérification à l'ouverture de l'app)
 *   - AnalyticsCoach fetchContext (en optionnel)
 *
 * NE FAIT PAS : envoi de message proactif (c'est le rôle de /api/coach/proactive).
 * Cette fonction calcule + renvoie un signal, point.
 */

import 'server-only';
import { adminDb } from '@/lib/firebase/admin';

export type DisengagementLevel = 'none' | 'low' | 'medium' | 'high';

export interface DisengagementSignal {
  level: DisengagementLevel;
  /** Nombre de jours depuis le dernier food_log (null si jamais loggé) */
  days_since_last_food_log: number | null;
  /** Nombre de jours depuis le dernier checkin_daily (null si jamais loggé) */
  days_since_last_checkin: number | null;
  /** Nombre de jours depuis la dernière workout_session (null si jamais loggé) */
  days_since_last_workout: number | null;
  /** Nombre de jours depuis le dernier message user (pas assistant) — null si jamais */
  days_since_last_user_message: number | null;
  /** Variation d'adherence kcal sur les 7 derniers jours vs les 7 d'avant. -50 = baisse 50%. */
  adherence_drop_pct: number | null;
  /** Raisons humainement lisibles du signal détecté */
  signals: string[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(iso: string | undefined | null): number | null {
  if (!iso || typeof iso !== 'string') return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / DAY_MS);
}

export async function detectDisengagement(uid: string): Promise<DisengagementSignal> {
  const userRef = adminDb.collection('users').doc(uid);
  const signals: string[] = [];

  const [
    lastFoodLog,
    lastCheckin,
    lastWorkout,
    lastUserMessage,
    adherenceDelta,
  ] = await Promise.all([
    fetchLastDocDate(userRef, 'food_logs', 'logged_at'),
    fetchLastDocDate(userRef, 'checkins_daily', 'date'),
    fetchLastDocDate(userRef, 'workout_sessions', 'date'),
    fetchLastUserMessageDate(userRef),
    fetchAdherenceDeltaPct(userRef),
  ]);

  const dFood = daysAgo(lastFoodLog);
  const dCheckin = daysAgo(lastCheckin);
  const dWorkout = daysAgo(lastWorkout);
  const dUserMsg = daysAgo(lastUserMessage);

  if (dFood !== null && dFood >= 3) signals.push(`pas de food_log depuis ${dFood} jour(s)`);
  if (dCheckin !== null && dCheckin >= 3) signals.push(`pas de checkin depuis ${dCheckin} jour(s)`);
  if (dWorkout !== null && dWorkout >= 7) signals.push(`pas de séance depuis ${dWorkout} jour(s)`);
  if (dUserMsg !== null && dUserMsg >= 7) signals.push(`pas de message coach depuis ${dUserMsg} jour(s)`);
  if (adherenceDelta !== null && adherenceDelta <= -25)
    signals.push(`adherence kcal en baisse de ${Math.abs(adherenceDelta)}% sur 7j vs 7j précédents`);

  // Severity ladder. high = signal sérieux qui mérite un coup de coude proactif.
  let level: DisengagementLevel = 'none';
  if (signals.length >= 3) {
    level = 'high';
  } else if (signals.length === 2) {
    level = 'medium';
  } else if (signals.length === 1) {
    level = 'low';
  }

  // Override : 14+ jours sans rien = high automatique
  if (
    (dFood ?? 0) >= 14 ||
    (dCheckin ?? 0) >= 14 ||
    (dUserMsg ?? 0) >= 14
  ) {
    level = 'high';
  }

  return {
    level,
    days_since_last_food_log: dFood,
    days_since_last_checkin: dCheckin,
    days_since_last_workout: dWorkout,
    days_since_last_user_message: dUserMsg,
    adherence_drop_pct: adherenceDelta,
    signals,
  };
}

async function fetchLastDocDate(
  userRef: FirebaseFirestore.DocumentReference,
  collection: string,
  dateField: string,
): Promise<string | null> {
  try {
    const snap = await userRef.collection(collection).orderBy(dateField, 'desc').limit(1).get();
    const doc = snap.docs[0]?.data();
    const val = doc?.[dateField];
    return typeof val === 'string' ? val : null;
  } catch (e) {
    console.warn(`[disengagement] fetch ${collection}.${dateField} failed:`, e);
    return null;
  }
}

async function fetchLastUserMessageDate(
  userRef: FirebaseFirestore.DocumentReference,
): Promise<string | null> {
  try {
    const snap = await userRef
      .collection('coach_messages')
      .where('role', '==', 'user')
      .orderBy('timestamp', 'desc')
      .limit(1)
      .get();
    const doc = snap.docs[0]?.data();
    return typeof doc?.timestamp === 'string' ? doc.timestamp : null;
  } catch (e) {
    console.warn('[disengagement] last user_message fetch failed:', e);
    return null;
  }
}

/**
 * Calcule la variation d'adherence kcal sur les 7 derniers jours vs les 7 d'avant.
 * Retourne un % négatif si l'user logge moins. Null si pas assez de data.
 */
async function fetchAdherenceDeltaPct(
  userRef: FirebaseFirestore.DocumentReference,
): Promise<number | null> {
  try {
    const sevenDays = 7 * DAY_MS;
    const fourteenDaysAgoIso = new Date(Date.now() - 2 * sevenDays).toISOString();

    const snap = await userRef
      .collection('food_logs')
      .where('logged_at', '>=', fourteenDaysAgoIso)
      .get();

    if (snap.empty) return null;

    const sevenDayCutoff = Date.now() - sevenDays;
    let recentCount = 0;
    let previousCount = 0;
    snap.docs.forEach((d) => {
      const data = d.data();
      const t = data.logged_at ? new Date(data.logged_at).getTime() : 0;
      if (t >= sevenDayCutoff) recentCount += 1;
      else previousCount += 1;
    });

    if (previousCount === 0) return null;
    const deltaPct = ((recentCount - previousCount) / previousCount) * 100;
    return Math.round(deltaPct);
  } catch (e) {
    console.warn('[disengagement] adherence_delta fetch failed:', e);
    return null;
  }
}
