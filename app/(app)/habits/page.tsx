'use client';

/**
 * Page /habits — habitudes long-terme + tick quotidien.
 *
 * - Form pour ajouter une habit (name, category, frequency, target_time)
 * - Liste des habits du jour avec tick rapide
 * - Streak visible par habit
 */

import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  setDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/firebase/hooks';

interface HabitDoc {
  id: string;
  name: string;
  category: string;
  target_time?: string;
  frequency: string;
  days_of_week?: number[];
  weekly_target_count?: number;
  active: boolean;
  current_streak?: number;
  longest_streak?: number;
  total_completions?: number;
}

interface HabitLogDoc {
  date: string;
  habit_id: string;
  completed: boolean;
}

const CATEGORIES = [
  { key: 'morning', label: 'Matin' },
  { key: 'evening', label: 'Soir' },
  { key: 'meal', label: 'Repas' },
  { key: 'training', label: 'Training' },
  { key: 'recovery', label: 'Récup' },
  { key: 'mental', label: 'Mental' },
  { key: 'other', label: 'Autre' },
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayIso(): string {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export default function HabitsPage() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [habits, setHabits] = useState<HabitDoc[]>([]);
  const [todayLogs, setTodayLogs] = useState<Record<string, boolean>>({});

  // Form
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('morning');
  const [formTargetTime, setFormTargetTime] = useState('');
  const [formFrequency, setFormFrequency] = useState('daily');

  async function reloadAll() {
    if (!user) return;
    const [habitsSnap, logsSnap] = await Promise.all([
      getDocs(query(collection(db, 'users', user.uid, 'habits'), where('active', '==', true))),
      getDocs(query(collection(db, 'users', user.uid, 'habit_logs'), where('date', '==', todayIso()))),
    ]);
    setHabits(habitsSnap.docs.map((d) => ({ ...(d.data() as HabitDoc), id: d.id })));
    const logs: Record<string, boolean> = {};
    logsSnap.forEach((d) => {
      const data = d.data() as HabitLogDoc;
      logs[data.habit_id] = !!data.completed;
    });
    setTodayLogs(logs);
  }

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        if (!cancelled) await reloadAll();
      } catch (e) {
        if (!cancelled) setErrorText(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function addHabit() {
    if (!user || !formName.trim()) return;
    try {
      const payload: Partial<HabitDoc> & { created_at: unknown; active: boolean } = {
        name: formName.trim().slice(0, 100),
        category: formCategory,
        frequency: formFrequency,
        active: true,
        current_streak: 0,
        longest_streak: 0,
        total_completions: 0,
        created_at: serverTimestamp(),
      };
      if (formTargetTime) payload.target_time = formTargetTime;
      await addDoc(collection(db, 'users', user.uid, 'habits'), payload);
      setFormName('');
      setFormTargetTime('');
      await reloadAll();
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : String(e));
    }
  }

  async function deleteHabit(habitId: string) {
    if (!user) return;
    if (!confirm('Supprimer cette habitude (et son historique sera détaché) ?')) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'habits', habitId));
      await reloadAll();
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : String(e));
    }
  }

  async function toggleToday(habit: HabitDoc) {
    if (!user) return;
    const wasCompleted = !!todayLogs[habit.id];
    const newCompleted = !wasCompleted;
    const logId = `${todayIso()}_${habit.id}`;
    try {
      await setDoc(doc(db, 'users', user.uid, 'habit_logs', logId), {
        date: todayIso(),
        habit_id: habit.id,
        completed: newCompleted,
        logged_at: serverTimestamp(),
      });

      // Recompute streak côté client (best-effort).
      // Increment if marking completed AND yesterday was completed or no log yesterday.
      // Reset to 0 if unchecking today.
      if (newCompleted) {
        const yLog = await getDocs(
          query(
            collection(db, 'users', user.uid, 'habit_logs'),
            where('date', '==', yesterdayIso()),
            where('habit_id', '==', habit.id),
          ),
        );
        const yesterdayCompleted = yLog.docs[0]?.data()?.completed === true;
        const newStreak = yesterdayCompleted ? (habit.current_streak ?? 0) + 1 : 1;
        const newLongest = Math.max(habit.longest_streak ?? 0, newStreak);
        await updateDoc(doc(db, 'users', user.uid, 'habits', habit.id), {
          current_streak: newStreak,
          longest_streak: newLongest,
          total_completions: (habit.total_completions ?? 0) + 1,
        });
      } else {
        await updateDoc(doc(db, 'users', user.uid, 'habits', habit.id), {
          current_streak: 0,
          total_completions: Math.max((habit.total_completions ?? 0) - 1, 0),
        });
      }
      setTodayLogs({ ...todayLogs, [habit.id]: newCompleted });
      await reloadAll();
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : String(e));
    }
  }

  const byCategory = useMemo(() => {
    const groups: Record<string, HabitDoc[]> = {};
    for (const h of habits) {
      const cat = h.category ?? 'other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(h);
    }
    return groups;
  }, [habits]);

  if (authLoading || loading) return <div className="p-6">Chargement…</div>;
  if (!user) return <div className="p-6">Connexion requise.</div>;

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Habitudes</h1>
        <p className="text-sm text-gray-500">
          Tes routines récurrentes. Tick rapide chaque jour, streak compté.
        </p>
      </header>

      {errorText && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {errorText}
        </div>
      )}

      {/* Add form */}
      <section className="rounded-md border border-gray-200 p-4 space-y-2">
        <h2 className="text-sm font-semibold">Nouvelle habitude</h2>
        <div className="space-y-2">
          <input
            type="text"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="Ex: 30g protéine avant 9h, pas d'écran après 22h…"
            maxLength={100}
            className="w-full rounded-md border border-gray-300 p-2 text-sm"
          />
          <div className="grid grid-cols-3 gap-2">
            <select
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value)}
              className="rounded-md border border-gray-300 p-2 text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
            <select
              value={formFrequency}
              onChange={(e) => setFormFrequency(e.target.value)}
              className="rounded-md border border-gray-300 p-2 text-sm"
            >
              <option value="daily">Tous les jours</option>
              <option value="weekly_n">N fois / semaine</option>
              <option value="specific_days">Jours spécifiques</option>
            </select>
            <input
              type="time"
              value={formTargetTime}
              onChange={(e) => setFormTargetTime(e.target.value)}
              placeholder="HH:MM"
              className="rounded-md border border-gray-300 p-2 text-sm"
            />
          </div>
          <button
            onClick={addHabit}
            disabled={!formName.trim()}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Ajouter
          </button>
        </div>
      </section>

      {/* Today's habits */}
      {habits.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Aujourd'hui ({todayIso()})</h2>
          {CATEGORIES.map((c) => {
            const items = byCategory[c.key] ?? [];
            if (items.length === 0) return null;
            return (
              <div key={c.key} className="rounded-md border border-gray-200 p-3 space-y-2">
                <h3 className="text-xs font-semibold uppercase text-gray-500">{c.label}</h3>
                {items.map((h) => {
                  const done = !!todayLogs[h.id];
                  return (
                    <div key={h.id} className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => toggleToday(h)}
                        className="flex-1 flex items-center gap-3 p-2 rounded hover:bg-gray-50 text-left"
                      >
                        <div
                          className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                            done ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300'
                          }`}
                        >
                          {done && '✓'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm ${done ? 'line-through text-gray-500' : ''}`}>
                            {h.name}
                            {h.target_time && (
                              <span className="text-xs text-gray-400 ml-2">@ {h.target_time}</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">
                            🔥 streak {h.current_streak ?? 0} · record {h.longest_streak ?? 0}
                          </div>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteHabit(h.id)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </section>
      )}

      {habits.length === 0 && (
        <div className="rounded-md border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-600">
          Pas encore d'habitude. Ajoute-en au moins une au-dessus pour démarrer.
        </div>
      )}
    </div>
  );
}
