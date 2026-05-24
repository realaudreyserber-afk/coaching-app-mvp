/* eslint-disable @typescript-eslint/no-explicit-any */
import * as admin from 'firebase-admin';

// Helper to initialize Firebase Admin on demand
function getAdminApp() {
  if (!admin.apps.length) {
    try {
      const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY
        ? process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n')
        : undefined;

      if (projectId && clientEmail && privateKey) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey,
          }),
          storageBucket: `${projectId}.appspot.com`,
        });
      } else {
        console.warn('Firebase Admin running in mock/offline mode (expected during next build)');
      }
    } catch (error) {
      console.error('Firebase Admin initialization error:', error);
    }
  }
}

// Lazy Proxy wrappers to prevent module initialization errors during "next build" compilation
export const adminAuth = new Proxy({} as admin.auth.Auth, {
  get(target, prop) {
    getAdminApp();
    if (!admin.apps.length) {
      const allowNoop =
        process.env.NEXT_PHASE === 'phase-production-build' ||
        process.env.NODE_ENV !== 'production' ||
        process.env.ENABLE_MOCK_AUTH === '1';
      if (allowNoop) {
        return () => {};
      }
      throw new Error(
        'Firebase Admin SDK non initialisé. Vérifie FIREBASE_ADMIN_PROJECT_ID / CLIENT_EMAIL / PRIVATE_KEY.'
      );
    }
    const service = admin.auth();
    const value = (service as any)[prop];
    return typeof value === 'function' ? value.bind(service) : value;
  }
});

export const adminDb = new Proxy({} as admin.firestore.Firestore, {
  get(target, prop) {
    getAdminApp();
    if (!admin.apps.length) {
      const allowNoop =
        process.env.NEXT_PHASE === 'phase-production-build' ||
        process.env.NODE_ENV !== 'production' ||
        process.env.ENABLE_MOCK_AUTH === '1';
      if (allowNoop) {
        return () => {};
      }
      throw new Error(
        'Firebase Admin SDK non initialisé. Vérifie FIREBASE_ADMIN_PROJECT_ID / CLIENT_EMAIL / PRIVATE_KEY.'
      );
    }
    const service = admin.firestore();
    const value = (service as any)[prop];
    return typeof value === 'function' ? value.bind(service) : value;
  }
});

export const adminStorage = new Proxy({} as admin.storage.Storage, {
  get(target, prop) {
    getAdminApp();
    if (!admin.apps.length) {
      const allowNoop =
        process.env.NEXT_PHASE === 'phase-production-build' ||
        process.env.NODE_ENV !== 'production' ||
        process.env.ENABLE_MOCK_AUTH === '1';
      if (allowNoop) {
        return () => {};
      }
      throw new Error(
        'Firebase Admin SDK non initialisé. Vérifie FIREBASE_ADMIN_PROJECT_ID / CLIENT_EMAIL / PRIVATE_KEY.'
      );
    }
    const service = admin.storage();
    const value = (service as any)[prop];
    return typeof value === 'function' ? value.bind(service) : value;
  }
});

export const adminFieldValue = {
  arrayUnion: (...args: any[]) => {
    getAdminApp();
    if (!admin.apps.length) return []; // mock fallback
    return admin.firestore.FieldValue.arrayUnion(...args);
  },
  arrayRemove: (...args: any[]) => {
    getAdminApp();
    if (!admin.apps.length) return [];
    return admin.firestore.FieldValue.arrayRemove(...args);
  },
  serverTimestamp: () => {
    getAdminApp();
    if (!admin.apps.length) return new Date();
    return admin.firestore.FieldValue.serverTimestamp();
  }
};

export const adminMessaging = new Proxy({} as admin.messaging.Messaging, {
  get(target, prop) {
    getAdminApp();
    if (!admin.apps.length) {
      const allowNoop =
        process.env.NEXT_PHASE === 'phase-production-build' ||
        process.env.NODE_ENV !== 'production' ||
        process.env.ENABLE_MOCK_AUTH === '1';
      if (allowNoop) {
        return () => {};
      }
      throw new Error(
        'Firebase Admin SDK non initialisé. Vérifie FIREBASE_ADMIN_PROJECT_ID / CLIENT_EMAIL / PRIVATE_KEY.'
      );
    }
    const service = admin.messaging();
    const value = (service as any)[prop];
    return typeof value === 'function' ? value.bind(service) : value;
  }
});
