/**
 * Unified health metrics integration (Web, Android Health Connect, iOS HealthKit)
 * Web implementation relies on Google Fit OAuth 2.0 API.
 * Mobile native implementations use Capacitor plugins.
 */

export interface HealthData {
  steps: number;
  calories: number;
  sleepMinutes: number;
  heartRateAverage: number;
}

export function isHealthAvailable(): boolean {
  // Check if running inside Capacitor native context or client web supports basic features
  if (typeof window !== 'undefined') {
    const isCapacitor = (window as typeof window & { Capacitor?: unknown }).Capacitor !== undefined;
    return isCapacitor || navigator.onLine;
  }
  return false;
}

export async function requestHealthPermissions(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const isCapacitor = (window as typeof window & { Capacitor?: unknown }).Capacitor !== undefined;
  if (isCapacitor) {
    // Stub Capacitor community health permissions trigger
    console.log("Requesting native health permissions (Health Connect / HealthKit)...");
    return true;
  }

  // Web fallback: Permissions handled by Google Fit OAuth redirect flow
  console.log("Web health permissions are managed via Google Fit OAuth flow.");
  return true;
}

/**
 * Returns mock/stub values for E2E tests and local dev when no connections are configured.
 */
export function getMockHealthData(): HealthData {
  return {
    steps: 8420,
    calories: 420,
    sleepMinutes: 440, // 7h 20m
    heartRateAverage: 65,
  };
}
