/**
 * Phase 6 data-layer — Cravings granulaires.
 *
 * PAS de nouvelle collection — extension de checkins_daily avec 3 champs :
 *   cravings_types: string[] (sweet/salty/fatty/caffeine/alcohol/specific_food)
 *   cravings_intensity: number 0-10
 *   cravings_trigger: string libre (200 chars max)
 *
 * Ce store offre une vue agrégée des cravings sur 7 jours pour les agents
 * (sans avoir à refetcher les checkins).
 */

import 'server-only';
import { adminDb } from '@/lib/firebase/admin';

interface CheckinWithCravings {
  date?: string;
  cravings_types?: string[];
  cravings_intensity?: number;
  cravings_trigger?: string;
}

export interface CravingsSnapshot {
  /** Compteur par type sur 7 jours */
  by_type_7day: Record<string, number>;
  /** Intensité moyenne sur 7 jours (jours avec cravings only) */
  avg_intensity_7day: number;
  /** Nombre de jours avec au moins 1 craving */
  days_with_cravings_7day: number;
  /** Triggers récurrents (apparaissant 2+ fois) */
  recurrent_triggers: string[];
  /** Cravings aujourd'hui (si checkin existe) */
  today: {
    types: string[];
    intensity: number;
    trigger?: string;
  } | null;
}

export async function getCravingsSnapshot(uid: string): Promise<CravingsSnapshot | null> {
  try {
    const snap = await adminDb
      .collection('users')
      .doc(uid)
      .collection('checkins_daily')
      .orderBy('date', 'desc')
      .limit(7)
      .get();
    const docs: CheckinWithCravings[] = snap.docs.map((d) => d.data() as CheckinWithCravings);
    if (docs.length === 0) return null;

    const todayIso = new Date().toISOString().slice(0, 10);
    const byType: Record<string, number> = {};
    const triggerCounts: Record<string, number> = {};
    let intensitySum = 0;
    let intensityCount = 0;
    let daysWithCravings = 0;
    let todaySnap: CravingsSnapshot['today'] = null;

    for (const d of docs) {
      const types = Array.isArray(d.cravings_types) ? d.cravings_types : [];
      const intensity = typeof d.cravings_intensity === 'number' ? d.cravings_intensity : 0;
      const trigger = typeof d.cravings_trigger === 'string' ? d.cravings_trigger.trim() : '';

      if (types.length > 0) {
        daysWithCravings += 1;
        for (const t of types) byType[t] = (byType[t] ?? 0) + 1;
      }
      if (intensity > 0) {
        intensitySum += intensity;
        intensityCount += 1;
      }
      if (trigger) {
        triggerCounts[trigger] = (triggerCounts[trigger] ?? 0) + 1;
      }

      if (d.date === todayIso) {
        todaySnap = { types, intensity, trigger: trigger || undefined };
      }
    }

    const recurrentTriggers = Object.entries(triggerCounts)
      .filter(([, c]) => c >= 2)
      .map(([t]) => t)
      .slice(0, 5);

    return {
      by_type_7day: byType,
      avg_intensity_7day: intensityCount > 0 ? Math.round((intensitySum / intensityCount) * 10) / 10 : 0,
      days_with_cravings_7day: daysWithCravings,
      recurrent_triggers: recurrentTriggers,
      today: todaySnap,
    };
  } catch (e) {
    console.warn('[cravings/store] getCravingsSnapshot failed:', e);
    return null;
  }
}
