import { FastingProtocol } from './schema';

export interface FastingState {
  isEatingWindow: boolean;
  timeRemainingMs: number;
  label: string;
}

/**
 * Calculates the current fasting state based on the user's protocol and the current time.
 */
export function getFastingState(protocol: FastingProtocol | null | undefined, now: Date = new Date()): FastingState {
  if (!protocol || !protocol.active || protocol.type === 'none') {
    return { isEatingWindow: true, timeRemainingMs: 0, label: "Jeûne inactif" };
  }

  const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  if (protocol.days_active && !protocol.days_active.includes(currentDay)) {
    return { isEatingWindow: true, timeRemainingMs: 0, label: "Pas de jeûne aujourd'hui" };
  }

  const [startH, startM] = protocol.eating_window_start.split(':').map(Number);
  const [endH, endM] = protocol.eating_window_end.split(':').map(Number);

  // Minutes from midnight for current time, start and end
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const currentSeconds = now.getSeconds();
  const currentTotalMs = (currentMinutes * 60 + currentSeconds) * 1000 + now.getMilliseconds();

  const startTotalMinutes = startH * 60 + startM;
  const startTotalMs = startTotalMinutes * 60 * 1000;

  const endTotalMinutes = endH * 60 + endM;
  const endTotalMs = endTotalMinutes * 60 * 1000;

  const msInDay = 24 * 60 * 60 * 1000;

  let isEatingWindow = false;
  let timeRemainingMs = 0;

  if (startTotalMs < endTotalMs) {
    // Normal window within the same day (e.g., 12:00 to 20:00)
    if (currentTotalMs >= startTotalMs && currentTotalMs < endTotalMs) {
      isEatingWindow = true;
      timeRemainingMs = endTotalMs - currentTotalMs;
    } else {
      isEatingWindow = false;
      if (currentTotalMs < startTotalMs) {
        timeRemainingMs = startTotalMs - currentTotalMs;
      } else {
        // Next eating window is tomorrow at startTotalMs
        timeRemainingMs = (msInDay - currentTotalMs) + startTotalMs;
      }
    }
  } else {
    // Spans across midnight (e.g., 20:00 to 04:00)
    if (currentTotalMs >= startTotalMs || currentTotalMs < endTotalMs) {
      isEatingWindow = true;
      if (currentTotalMs >= startTotalMs) {
        timeRemainingMs = (msInDay - currentTotalMs) + endTotalMs;
      } else {
        timeRemainingMs = endTotalMs - currentTotalMs;
      }
    } else {
      isEatingWindow = false;
      timeRemainingMs = startTotalMs - currentTotalMs;
    }
  }

  const hours = Math.floor(timeRemainingMs / (1000 * 60 * 60));
  const minutes = Math.floor((timeRemainingMs % (1000 * 60 * 60)) / (1000 * 60));

  let label = "";
  if (isEatingWindow) {
    label = `Fenêtre d'alimentation active. Fin dans ${hours}h ${minutes}m.`;
  } else {
    label = `Période de jeûne active. Fin dans ${hours}h ${minutes}m.`;
  }

  return {
    isEatingWindow,
    timeRemainingMs,
    label,
  };
}
