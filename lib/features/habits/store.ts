/**
 * CRUD + snapshot habits pour agents.
 */

import 'server-only';
import { adminDb } from '@/lib/firebase/admin';
import type { Habit, HabitLog } from './schema';

export async function listActiveHabits(uid: string): Promise<Array<Habit & { id: string }>> {
  try {
    const snap = await adminDb
      .collection('users')
      .doc(uid)
      .collection('habits')
      .where('active', '==', true)
      .get();
    return snap.docs.map((d) => ({ ...(d.data() as Habit), id: d.id }));
  } catch (e) {
    console.warn('[habits/store] listActiveHabits failed:', e);
    return [];
  }
}

export async function listRecentHabitLogs(
  uid: string,
  daysBack = 30,
): Promise<HabitLog[]> {
  try {
    const cutoff = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const snap = await adminDb
      .collection('users')
      .doc(uid)
      .collection('habit_logs')
      .where('date', '>=', cutoff)
      .get();
    return snap.docs.map((d) => d.data() as HabitLog);
  } catch (e) {
    console.warn('[habits/store] listRecentHabitLogs failed:', e);
    return [];
  }
}

export interface HabitsSnapshot {
  active_count: number;
  /** Adherence % sur les 7 derniers jours (logs completed / logs total) */
  adherence_7day_pct: number;
  /** Adherence % sur les 30 derniers jours */
  adherence_30day_pct: number;
  /** Habits avec leur current streak */
  habits_summary: Array<{
    name: string;
    category: string;
    current_streak: number;
    longest_streak: number;
  }>;
  /** Habits en risque (streak récemment cassé après >= 7 jours) */
  recently_broken: Array<{ name: string; previous_streak: number }>;
}

export async function getHabitsSnapshot(uid: string): Promise<HabitsSnapshot | null> {
  try {
    const [habits, logs7, logs30] = await Promise.all([
      listActiveHabits(uid),
      listRecentHabitLogs(uid, 7),
      listRecentHabitLogs(uid, 30),
    ]);
    if (habits.length === 0) return null;

    const adherence = (logs: HabitLog[]) => {
      if (logs.length === 0) return 0;
      const completed = logs.filter((l) => l.completed).length;
      return Math.round((completed / logs.length) * 100);
    };

    return {
      active_count: habits.length,
      adherence_7day_pct: adherence(logs7),
      adherence_30day_pct: adherence(logs30),
      habits_summary: habits.map((h) => ({
        name: h.name,
        category: h.category,
        current_streak: h.current_streak ?? 0,
        longest_streak: h.longest_streak ?? 0,
      })),
      recently_broken: habits
        .filter((h) => (h.current_streak ?? 0) === 0 && (h.longest_streak ?? 0) >= 7)
        .map((h) => ({ name: h.name, previous_streak: h.longest_streak ?? 0 })),
    };
  } catch (e) {
    console.warn('[habits/store] snapshot failed:', e);
    return null;
  }
}
