import { db } from '@/lib/firebase/client';
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  runTransaction,
  setDoc,
} from 'firebase/firestore';

/**
 * M17 — Referral service.
 *
 * Schema (per ADR-006 snake_case + maps imbriquées):
 *   users/{uid}.referral = {
 *     code: 'INSXXX',
 *     referred_by?: uid,
 *     referred_users: uid[],
 *     premium_credits: number,
 *     updated_at: ISO,
 *   }
 *
 * Reward: +1 month Premium credit to both referrer and referred.
 */

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export function generateReferralCode(): string {
  let result = 'INS';
  for (let i = 0; i < 3; i++) {
    result += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
  }
  return result;
}

/**
 * Ensure the user has a referral code assigned. Idempotent: returns existing
 * code or generates one if absent.
 */
export async function ensureReferralCode(uid: string): Promise<string> {
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  const existing = snap.data()?.referral?.code as string | undefined;
  if (existing) return existing;

  // Try a few times to avoid collisions
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateReferralCode();
    const q = query(collection(db, 'users'), where('referral.code', '==', candidate));
    const existsSnap = await getDocs(q);
    if (existsSnap.empty) {
      await setDoc(
        userRef,
        {
          referral: {
            code: candidate,
            referred_users: [],
            premium_credits: 0,
            updated_at: new Date().toISOString(),
          },
        },
        { merge: true }
      );
      return candidate;
    }
  }
  throw new Error('Impossible de générer un code de parrainage unique.');
}

export async function applyReferralCode(
  referredUid: string,
  code: string
): Promise<{ success: boolean; referrer_name: string }> {
  const normalized = code.toUpperCase().trim();

  const q = query(collection(db, 'users'), where('referral.code', '==', normalized));
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    throw new Error('Code de parrainage invalide.');
  }

  const referrerDoc = snapshot.docs[0];
  const referrerUid = referrerDoc.id;
  const referrerData = referrerDoc.data();

  if (referrerUid === referredUid) {
    throw new Error('Tu ne peux pas parrainer ton propre compte.');
  }

  const userRef = doc(db, 'users', referredUid);
  const userSnap = await getDoc(userRef);
  const userData = userSnap.data();

  if (userData?.referral?.referred_by) {
    throw new Error('Tu as déjà été parrainé par un autre utilisateur.');
  }

  await runTransaction(db, async (transaction) => {
    const freshUserDoc = await transaction.get(userRef);
    const freshReferrerDoc = await transaction.get(referrerDoc.ref);
    const uData = freshUserDoc.data() || {};
    const rData = freshReferrerDoc.data() || {};

    if (uData.referral?.referred_by) {
      throw new Error('Déjà parrainé.');
    }

    transaction.set(
      userRef,
      {
        referral: {
          referred_by: referrerUid,
          premium_credits: (uData.referral?.premium_credits || 0) + 1,
          updated_at: new Date().toISOString(),
        },
      },
      { merge: true }
    );

    const referredUsersList: string[] = rData.referral?.referred_users || [];
    transaction.set(
      freshReferrerDoc.ref,
      {
        referral: {
          referred_users: [...referredUsersList, referredUid],
          premium_credits: (rData.referral?.premium_credits || 0) + 1,
          updated_at: new Date().toISOString(),
        },
      },
      { merge: true }
    );
  });

  return {
    success: true,
    referrer_name: referrerData.profile?.name || 'Abonné',
  };
}
