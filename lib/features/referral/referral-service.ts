import { db } from '@/lib/firebase/client';
import { doc, getDoc, collection, query, where, getDocs, runTransaction } from 'firebase/firestore';

/**
 * Generates a random 6-character referral code with 'INS' prefix.
 */
export function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'INS';
  for (let i = 0; i < 3; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Applies a referral code. Updates both the referrer and the referred user.
 * Awards +1 premium credit month to both users.
 */
export async function applyReferralCode(referredUid: string, code: string): Promise<{ success: boolean; referrerName: string }> {
  // Query to find the user owning this referral code
  const q = query(
    collection(db, 'users'),
    where('referral.code', '==', code.toUpperCase().trim())
  );
  
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    throw new Error("Code de parrainage invalide.");
  }

  const referrerDoc = snapshot.docs[0];
  const referrerUid = referrerDoc.id;
  const referrerData = referrerDoc.data();

  if (referrerUid === referredUid) {
    throw new Error("Tu ne peux pas parrainer ton propre compte.");
  }

  // Check if current user already has a referrer
  const userRef = doc(db, 'users', referredUid);
  const userSnap = await getDoc(userRef);
  const userData = userSnap.data();

  if (userData?.referral?.referredBy) {
    throw new Error("Tu as déjà été parrainé par un autre utilisateur.");
  }

  // Use a transaction to safely update both documents and prevent race conditions
  await runTransaction(db, async (transaction) => {
    const freshUserDoc = await transaction.get(userRef);
    const freshReferrerDoc = await transaction.get(referrerDoc.ref);

    const uData = freshUserDoc.data() || {};
    const rData = freshReferrerDoc.data() || {};

    const currentReferredBy = uData.referral?.referredBy || null;
    if (currentReferredBy) {
      throw new Error("Déjà parrainé.");
    }

    // Update referred user
    transaction.update(userRef, {
      'referral.referredBy': referrerUid,
      'referral.premiumCredits': (uData.referral?.premiumCredits || 0) + 1,
      'referral.updatedAt': new Date().toISOString()
    });

    // Update referrer user
    const referredUsersList = rData.referral?.referredUsers || [];
    transaction.update(referrerDoc.ref, {
      'referral.referredUsers': [...referredUsersList, referredUid],
      'referral.premiumCredits': (rData.referral?.premiumCredits || 0) + 1,
      'referral.updatedAt': new Date().toISOString()
    });
  });

  return {
    success: true,
    referrerName: referrerData.profile?.name || "Abonné"
  };
}
