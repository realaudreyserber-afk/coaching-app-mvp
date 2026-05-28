'use client';

/**
 * Page /hydration — quick log + history hydratation.
 *
 * Boutons de quick-log : +250ml, +500ml, +1L. Progress bar vs target.
 * Affichage simplifié — pas une page lourde, c'est pour logger en 2 sec.
 */

import { useEffect, useMemo, useState } from 'react';
import { doc, getDoc, setDoc, collection, query, orderBy, limit, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/firebase/hooks';

interface HydrationEntry {
  time: string;
  ml: number;
  type: string;
}

interface HydrationLogDoc {
  date: string;
  entries?: HydrationEntry[];
  total_ml?: number;
  target_ml?: number;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function currentTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const QUICK_AMOUNTS = [250, 500, 1000];
const TYPES = [
  { key: 'water', label: 'Eau' },
  { key: 'tea', label: 'Thé' },
  { key: 'coffee', label: 'Café' },
  { key: 'sparkling', label: 'Pétillante' },
  { key: 'electrolyte', label: 'Électrolyte' },
];

export default function HydrationPage() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [today, setToday] = useState<HydrationLogDoc | null>(null);
  const [history, setHistory] = useState<HydrationLogDoc[]>([]);
  const [target, setTarget] = useState(2500);
  const [selectedType, setSelectedType] = useState('water');

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [todaySnap, historySnap] = await Promise.all([
          getDoc(doc(db, 'users', user.uid, 'hydration_log', todayIso())),
          getDocs(
            query(
              collection(db, 'users', user.uid, 'hydration_log'),
              orderBy('date', 'desc'),
              limit(7),
            ),
          ),
        ]);
        if (cancelled) return;
        if (todaySnap.exists()) {
          const data = todaySnap.data() as HydrationLogDoc;
          setToday(data);
          if (data.target_ml) setTarget(data.target_ml);
        }
        setHistory(historySnap.docs.map((d) => d.data() as HydrationLogDoc));
      } catch (e) {
        if (!cancelled) setErrorText(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function addEntry(ml: number) {
    if (!user) return;
    setSaving(true);
    setErrorText(null);
    try {
      const newEntry: HydrationEntry = { time: currentTime(), ml, type: selectedType };
      const newEntries = [...(today?.entries ?? []), newEntry];
      const newTotal = newEntries.reduce((s, e) => s + e.ml, 0);
      const updated: HydrationLogDoc = {
        date: todayIso(),
        entries: newEntries,
        total_ml: newTotal,
        target_ml: target,
      };
      await setDoc(
        doc(db, 'users', user.uid, 'hydration_log', todayIso()),
        { ...updated, updated_at: serverTimestamp() },
        { merge: true },
      );
      setToday(updated);
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function updateTarget(newTarget: number) {
    if (!user) return;
    setSaving(true);
    try {
      await setDoc(
        doc(db, 'users', user.uid, 'hydration_log', todayIso()),
        { date: todayIso(), target_ml: newTarget, updated_at: serverTimestamp() },
        { merge: true },
      );
      setTarget(newTarget);
      setToday({ ...(today ?? { date: todayIso() }), target_ml: newTarget });
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const totalToday = useMemo(
    () => (today?.entries ?? []).reduce((s, e) => s + e.ml, 0),
    [today],
  );
  const pct = Math.min(100, Math.round((totalToday / target) * 100));

  if (authLoading || loading) return <div className="p-6">Chargement…</div>;
  if (!user) return <div className="p-6">Connexion requise.</div>;

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Hydratation</h1>
        <p className="text-sm text-gray-500">
          Quick-log en 1 clic. Eau, thé, café et électrolytes comptent pour ton total
          effectif (coefficients dans le calcul agent).
        </p>
      </header>

      {errorText && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {errorText}
        </div>
      )}

      {/* Today summary */}
      <section className="rounded-md border border-gray-200 p-4 space-y-3">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-3xl font-bold">{(totalToday / 1000).toFixed(2)} L</div>
            <div className="text-sm text-gray-500">aujourd'hui · cible {(target / 1000).toFixed(1)} L</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-semibold text-blue-700">{pct}%</div>
            <div className="text-xs text-gray-500">{today?.entries?.length ?? 0} prises</div>
          </div>
        </div>
        <div className="w-full h-2 rounded-full bg-gray-200 overflow-hidden">
          <div
            className={`h-2 ${pct >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="space-y-2">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
            <div className="flex flex-wrap gap-1">
              {TYPES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setSelectedType(t.key)}
                  className={`px-2 py-1 rounded text-xs border ${
                    selectedType === t.key
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white border-gray-300 text-gray-700'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Ajouter</label>
            <div className="flex gap-2">
              {QUICK_AMOUNTS.map((ml) => (
                <button
                  key={ml}
                  type="button"
                  onClick={() => addEntry(ml)}
                  disabled={saving}
                  className="flex-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  +{ml >= 1000 ? `${ml / 1000} L` : `${ml} ml`}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Target adjust */}
      <section className="rounded-md border border-gray-200 p-4 space-y-2">
        <h2 className="text-sm font-semibold">Cible quotidienne</h2>
        <div className="flex gap-2">
          {[2000, 2500, 3000, 3500, 4000].map((ml) => (
            <button
              key={ml}
              type="button"
              onClick={() => updateTarget(ml)}
              className={`px-2 py-1 rounded text-xs border ${
                target === ml
                  ? 'bg-gray-800 text-white border-gray-800'
                  : 'bg-white border-gray-300 text-gray-700'
              }`}
            >
              {(ml / 1000).toFixed(1)} L
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500">
          Standard : 2.5 L. +500 ml si TRT (hématocrite) ou GLP-1 (soif réduite).
          +500-1000 ml si training intense ou chaleur.
        </p>
      </section>

      {/* Today's entries detail */}
      {(today?.entries?.length ?? 0) > 0 && (
        <section className="rounded-md border border-gray-200 p-4">
          <h2 className="text-sm font-semibold mb-2">Prises d'aujourd'hui</h2>
          <ul className="text-xs space-y-1">
            {(today?.entries ?? []).map((e, i) => (
              <li key={i} className="flex justify-between border-b last:border-b-0 py-1">
                <span className="text-gray-600">
                  {e.time} · {TYPES.find((t) => t.key === e.type)?.label ?? e.type}
                </span>
                <span className="font-medium">{e.ml} ml</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* History */}
      {history.length > 0 && (
        <section className="rounded-md border border-gray-200 p-4">
          <h2 className="text-sm font-semibold mb-2">7 derniers jours</h2>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 uppercase">
                <th className="text-left py-1">Date</th>
                <th className="text-right py-1">Total</th>
                <th className="text-right py-1">Cible</th>
                <th className="text-right py-1">%</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => {
                const total = (h.entries ?? []).reduce((s, e) => s + e.ml, 0);
                const t = h.target_ml ?? 2500;
                const p = Math.round((total / t) * 100);
                return (
                  <tr key={h.date} className="border-b last:border-b-0">
                    <td className="py-1.5 text-gray-600">{h.date}</td>
                    <td className="text-right py-1.5">{(total / 1000).toFixed(2)} L</td>
                    <td className="text-right py-1.5 text-gray-500">{(t / 1000).toFixed(1)} L</td>
                    <td className={`text-right py-1.5 ${p >= 100 ? 'text-green-700' : 'text-gray-500'}`}>
                      {p}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
