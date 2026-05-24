/**
 * Locale/timezone abstraction.
 * Web: Intl.DateTimeFormat for tz, navigator.language for locale.
 * Native (TODO Phase 2): @capacitor/device + @capacitor/geolocation if needed.
 */

export interface LocaleInfo {
  language: string;
  timezone: string;
  region?: string;
}

export function getLocaleInfo(): LocaleInfo {
  if (typeof window === 'undefined') {
    return { language: 'fr-FR', timezone: 'Europe/Paris' };
  }
  const language = navigator.language || 'fr-FR';
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris';
  const region = language.split('-')[1];
  return { language, timezone, region };
}
