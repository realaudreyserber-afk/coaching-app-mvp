import { db } from '@/lib/firebase/client';
import { doc, setDoc, updateDoc, collection, writeBatch } from 'firebase/firestore';

/**
 * Lightweight, deterministic string hashing algorithm (djb2)
 * Runs identically on server (Node.js) and client (browser) sides.
 */
export function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
  }
  return Math.abs(hash);
}

/**
 * Assigns a user to a specific variant (0, 1, 2, ...) deterministically
 * based on the user's UID and the experiment ID.
 */
export function getUserVariantIndex(uid: string, experimentId: string, variantsCount = 2): number {
  if (!uid) return 0;
  const combinedKey = `${uid}:${experimentId}`;
  const hash = hashString(combinedKey);
  return hash % variantsCount;
}

/**
 * Logs experiment exposure to Firestore under users/{uid}/experiments/{experimentId}
 */
export async function logExperimentExposure(uid: string, experimentId: string, variantName: string): Promise<void> {
  const isMockMode = typeof window !== 'undefined' && window.localStorage.getItem('mock_user') === 'true';
  if (isMockMode) return;

  try {
    const now = new Date().toISOString();
    const expRef = doc(db, 'users', uid, 'experiments', experimentId);
    const exposureRef = doc(collection(db, 'experiment_exposures'));

    const batch = writeBatch(db);
    batch.set(expRef, { variant: variantName, exposedAt: now, converted: false }, { merge: true });
    batch.set(exposureRef, {
      uid,
      experimentId,
      variant: variantName,
      timestamp: now,
      type: 'exposure',
    });
    await batch.commit();
  } catch (error) {
    console.error(`Failed to log experiment exposure for ${experimentId}:`, error);
  }
}

/**
 * Logs experiment conversion (e.g. subscribing to Premium, completing check-in)
 */
export async function logExperimentConversion(uid: string, experimentId: string, conversionType: string): Promise<void> {
  const isMockMode = typeof window !== 'undefined' && window.localStorage.getItem('mock_user') === 'true';
  if (isMockMode) return;

  try {
    const expRef = doc(db, 'users', uid, 'experiments', experimentId);
    await updateDoc(expRef, {
      converted: true,
      conversionType,
      convertedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error(`Failed to log experiment conversion for ${experimentId}:`, error);
  }
}
