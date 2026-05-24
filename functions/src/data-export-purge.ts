import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { logger } from 'firebase-functions';

export const dataExportPurge = onCall(
  {
    region: 'europe-west1',
    memory: '512MiB',
    timeoutSeconds: 540,
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Authentification requise.');

    const action = request.data?.action as 'export' | 'delete' | undefined;
    if (action !== 'export' && action !== 'delete') {
      throw new HttpsError('invalid-argument', "action doit être 'export' ou 'delete'");
    }

    const db = getFirestore();
    const storage = getStorage();

    if (action === 'delete') {
      const confirmText = request.data?.confirmText as string | undefined;
      if (confirmText !== 'EFFACER') {
        throw new HttpsError(
          'failed-precondition',
          "Confirmation requise : envoie confirmText='EFFACER' pour valider la suppression définitive."
        );
      }
      const recentLoginIatSec = request.auth?.token?.auth_time as number | undefined;
      const nowSec = Math.floor(Date.now() / 1000);
      if (!recentLoginIatSec || nowSec - recentLoginIatSec > 5 * 60) {
        throw new HttpsError(
          'failed-precondition',
          "Reconnexion requise dans les 5 dernières minutes pour confirmer la suppression."
        );
      }
      const userRef = db.collection('users').doc(uid);
      const subcollections = await userRef.listCollections();
      for (const sub of subcollections) {
        const docs = await sub.listDocuments();
        await Promise.all(docs.map(d => d.delete()));
      }
      await userRef.delete();

      const bucket = storage.bucket();
      await bucket.deleteFiles({ prefix: `users/${uid}/` });

      await db.collection('rgpd_audit_log').add({
        uid,
        action: 'delete',
        actor_email: request.auth?.token?.email ?? null,
        timestamp: new Date().toISOString(),
      });

      logger.info(`User ${uid} fully purged (RGPD Article 17).`);
      return { success: true, action: 'delete' };
    }

    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    const payload: Record<string, unknown> = {
      uid,
      exported_at: new Date().toISOString(),
      profile: userSnap.exists ? userSnap.data() : null,
    };

    const subcollections = await userRef.listCollections();
    for (const sub of subcollections) {
      const docs = await sub.get();
      payload[sub.id] = docs.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    return { success: true, action: 'export', data: payload };
  }
);
