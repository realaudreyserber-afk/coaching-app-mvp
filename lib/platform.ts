/**
 * Abstraction layer to handle web/PWA vs native Android (Capacitor) differences.
 * This ensures we don't break when wrappped in a WebView.
 */

export const isBrowser = (): boolean => {
  return typeof window !== 'undefined';
};

export const isNativePlatform = (): boolean => {
  if (!isBrowser()) return false;
  return (window as unknown as { Capacitor?: unknown }).Capacitor !== undefined;
};

/**
 * Encapsulated storage wrapper.
 * The brief forbids localStorage for business/user data (preferring Firestore offline persistence).
 * We only use this for minor client-only UI settings (e.g. theme preference).
 */
export const platformStorage = {
  getItem: (key: string): string | null => {
    if (!isBrowser()) return null;
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      console.error('Storage access failed:', e);
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    if (!isBrowser()) return;
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      console.error('Storage write failed:', e);
    }
  },
  removeItem: (key: string): void => {
    if (!isBrowser()) return;
    try {
      window.localStorage.removeItem(key);
    } catch (e) {
      console.error('Storage remove failed:', e);
    }
  }
};

/**
 * Safe navigation utility to avoid breaking Capacitor routing.
 * Always prefers Next.js router, but handles external links safely.
 */
export const safeOpenExternalUrl = (url: string): void => {
  if (!isBrowser()) return;
  
  if (isNativePlatform()) {
    // Capacitor will wrap this. For now, redirect current window instead of target="_blank"
    window.location.href = url;
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
};

/**
 * Handle push notifications subscription.
 * Will be replaced by native push notification plugin on Android.
 */
export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  if (!isBrowser()) return 'default';
  
  if ('Notification' in window) {
    return await Notification.requestPermission();
  }
  
  return 'denied';
};
