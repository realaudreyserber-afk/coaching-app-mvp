/**
 * CRUD + snapshot life events pour les agents.
 */

import 'server-only';
import { adminDb } from '@/lib/firebase/admin';
import { isEventActive, type LifeEvent } from './schema';

export async function listLifeEvents(uid: string, limit = 30): Promise<Array<LifeEvent & { id: string }>> {
  try {
    const snap = await adminDb
      .collection('users')
      .doc(uid)
      .collection('life_events')
      .orderBy('date_start', 'desc')
      .limit(limit)
      .get();
    return snap.docs.map((d) => ({ ...(d.data() as LifeEvent), id: d.id }));
  } catch (e) {
    console.warn('[life-events/store] listLifeEvents failed:', e);
    return [];
  }
}

export interface LifeEventsSnapshot {
  /** Événements actifs aujourd'hui */
  active_events: Array<{ type: string; severity: string; description: string; days_since_start: number; date_end?: string }>;
  /** Événements récents terminés (< 30 jours) */
  recent_past_events: Array<{ type: string; severity: string; description: string; days_since_end: number }>;
  /** Présence d'au moins un événement high severity actif */
  has_high_severity_active: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export async function getLifeEventsSnapshot(uid: string): Promise<LifeEventsSnapshot | null> {
  try {
    const events = await listLifeEvents(uid, 30);
    if (events.length === 0) return null;

    const todayIso = new Date().toISOString().slice(0, 10);
    const todayT = new Date(todayIso).getTime();
    const active: LifeEventsSnapshot['active_events'] = [];
    const recentPast: LifeEventsSnapshot['recent_past_events'] = [];
    let hasHigh = false;

    for (const e of events) {
      if (isEventActive(e, todayIso)) {
        const daysSinceStart = Math.floor((todayT - new Date(e.date_start).getTime()) / DAY_MS);
        active.push({
          type: e.type,
          severity: e.severity,
          description: e.description,
          days_since_start: daysSinceStart,
          date_end: e.date_end,
        });
        if (e.severity === 'high') hasHigh = true;
      } else if (e.date_end) {
        const daysSinceEnd = Math.floor((todayT - new Date(e.date_end).getTime()) / DAY_MS);
        if (daysSinceEnd <= 30 && daysSinceEnd >= 0) {
          recentPast.push({
            type: e.type,
            severity: e.severity,
            description: e.description,
            days_since_end: daysSinceEnd,
          });
        }
      }
    }

    return {
      active_events: active,
      recent_past_events: recentPast,
      has_high_severity_active: hasHigh,
    };
  } catch (e) {
    console.warn('[life-events/store] snapshot failed:', e);
    return null;
  }
}
