/**
 * Push notifications abstraction.
 * Web: Firebase Cloud Messaging via getFCM().
 * Native (TODO Phase 2): @capacitor/push-notifications + @capacitor-firebase/messaging.
 */
import { getFCM } from '@/lib/firebase/client';
import { isNativePlatform, requestNotificationPermission } from '@/lib/platform';

export interface PushSubscription {
  token: string;
  platform: 'web' | 'android' | 'ios';
}

export async function ensurePushPermission(): Promise<boolean> {
  const perm = await requestNotificationPermission();
  return perm === 'granted';
}

export async function getPushToken(vapidKey?: string): Promise<PushSubscription | null> {
  if (isNativePlatform()) {
    // TODO Phase 2: capacitor plugin returns native FCM token
    return null;
  }

  const granted = await ensurePushPermission();
  if (!granted) return null;

  const messaging = await getFCM();
  if (!messaging) return null;

  try {
    const { getToken } = await import('firebase/messaging');
    const key = vapidKey || process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    if (!key) {
      console.warn('NEXT_PUBLIC_FIREBASE_VAPID_KEY missing — cannot register push token.');
      return null;
    }
    const token = await getToken(messaging, { vapidKey: key });
    if (!token) return null;
    return { token, platform: 'web' };
  } catch (err) {
    console.error('Push token retrieval failed:', err);
    return null;
  }
}

export async function onPushMessage(handler: (payload: unknown) => void): Promise<() => void> {
  if (isNativePlatform()) return () => {};
  const messaging = await getFCM();
  if (!messaging) return () => {};
  const { onMessage } = await import('firebase/messaging');
  return onMessage(messaging, handler);
}
