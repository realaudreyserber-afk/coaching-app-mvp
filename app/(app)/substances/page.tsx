'use client';

/**
 * Page /substances — log caféine / alcool / nicotine.
 *
 * Form de log avec presets rapides + saisie libre. Affichage du total du jour
 * (caféine mg, alcool units, nicotine units) + history 7j.
 */

import { useEffect, useMemo, useState } from 'react';
import { doc, getDoc, setDoc, collection, query, orderBy, limit, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/firebase/hooks';

interface SubstanceEntry {
  time: string;
  type: string;
  quantity: number;
  unit: string;
  notes?: string;
}

interface SubstancesLogDoc {
  date: string;
  entries?: SubstanceEntry[];
}

const PRESETS: Array<{ label: string; type: string; quantity: number; unit: string }> = [
  { label: '☕ Café (1)', type: 'coffee', quantity: 1, unit: 'serving' },
  { label: '🍵 Thé (1)', type: 'tea_caffeinated', quantity: 1, unit: 'serving' },
  { label: '⚡ Energy drink', type: 'energy_drink', quantity: 1, unit: 'serving' },
  { label: '🍺 Bière 250ml', type: 'alcohol_beer', quantity: 250, unit: 'ml' },
  { label: '🍷 Vin 100ml', type: 'alcohol_wine', quantity: 100, unit: 'ml' },
  { label: '🥃 Spirit 3cl', type: 'alcohol_spirit', quantity: 3, unit: 'cl' },
  { label: '🍹 Cocktail (1)', type: 'alcohol_cocktail', quantity: 1, unit: 'serving' },
  { label: '🚬 Cigarette', type: 'nicotine_cigarette', quantity: 1, unit: 'unit' },
  { label: '💨 Vape session', type: 'nicotine_vape', quantity: 1, unit: 'unit' },
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function currentTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// Caffeine multipliers (sync with schema.ts)
const CAFFEINE_MG: Record<string, number> = {
  coffee: 95,
  tea_caffeinated: 40,
  energy_drink: 80,
  caffeine_pill: 100,
};

function computeCaffeine(entries: SubstanceEntry[]): number {
  let total = 0;
  for (const e of entries) {
    if (e.unit === 'mg') {
      total += e.quantity;
      continue;
    }
    const base = CAFFEINE_MG[e.type];
    if (base) total += base * e.quantity;
  }
  return Math.round(total);
}

function computeAlcohol(entries: SubstanceEntry[]): number {
  let u = 0;
  for (const e of entries) {
    switch (e.type) {
      case 'alcohol_beer': u += (e.quantity / 250); break;
      case 'alcohol_wine': u += (e.quantity / 100); break;
      case 'alcohol_spirit': u += (e.quantity / 3); break;
      case 'alcohol_cocktail': u += e.quantity * 1.5; break;
    }
  }
  return Math.round(u * 10) / 10;
}

function computeNicotine(entries: SubstanceEntry[]): number {
  return entries
    .filter((e) => e.type.startsWith('nicotine_'))
    .reduce((s, e) => s + e.quantity, 0);
}

export default function SubstancesPage() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [today, setToday] = useState<SubstancesLogDoc | null>(null);
  const [history, setHistory] = useState<SubstancesLogDoc[]>([]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [todaySnap, historySnap] = await Promise.all([
          getDoc(doc(db, 'users', user.uid, 'substances_log', todayIso())),
          getDocs(
            query(collection(db, 'users', user.uid, 'substances_log'), orderBy('date', 'desc'), limit(7)),
          ),
        ]);
        if (cancelled) return;
        if (todaySnap.exists()) setToday(todaySnap.data() as SubstancesLogDoc);
        setHistory(historySnap.docs.map((d) => d.data() as SubstancesLogDoc));
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

  async function addPreset(preset: typeof PRESETS[0]) {
    if (!user) return;
    setSaving(true);
    setErrorText(null);
    try {
      const newEntry: SubstanceEntry = {
        time: currentTime(),
        type: preset.type,
        quantity: preset.quantity,
        unit: preset.unit,
      };
      const newEntries = [...(today?.entries ?? []), newEntry];
      const updated: SubstancesLogDoc = { date: todayIso(), entries: newEntries };
      await setDoc(
        doc(db, 'users', user.uid, 'substances_log', todayIso()),
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

  const todayStats = useMemo(() => {
    const entries = today?.entries ?? [];
    return {
      caffeine: computeCaffeine(entries),
      alcohol: computeAlcohol(entries),
      nicotine: computeNicotine(entries),
      count: entries.length,
    };
  }, [today]);

  if (authLoading || loading) return <div className="p-6">Chargement…</div>;
  if (!user) return <div className="p-6">Connexion requise.</div>;

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Substances</h1>
        <p className="text-sm text-gray-500">
          Track caféine, alcool, nicotine. Impacte ton sommeil, ton cortisol, et la perte de gras
          (surtout l'alcool en cut). Pas de jugement — c'est de la data pour ton coach.
        </p>
      </header>

      {errorText && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {errorText}
        </div>
      )}

      {/* Today stats */}
      <section className="rounded-md border border-gray-200 p-4">
        <h2 className="text-sm font-semibold mb-3">Aujourd'hui</h2>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className={`text-2xl font-bold ${todayStats.caffeine > 400 ? 'text-amber-700' : 'text-gray-800'}`}>
              {todayStats.caffeine}
            </div>
            <div className="text-xs text-gray-500">mg caféine</div>
          </div>
          <div>
            <div className={`text-2xl font-bold ${todayStats.alcohol >= 2 ? 'text-red-700' : 'text-gray-800'}`}>
              {todayStats.alcohol}
            </div>
            <div className="text-xs text-gray-500">unités alcool</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-800">{todayStats.nicotine}</div>
            <div className="text-xs text-gray-500">unités nicotine</div>
          </div>
        </div>
        {todayStats.caffeine > 400 && (
          <p className="text-xs text-amber-700 mt-3">
            ⚠ Caféine &gt; 400 mg : impact sommeil + cortisol probable. Évite après 14h.
          </p>
        )}
      </section>

      {/* Quick log */}
      <section className="rounded-md border border-gray-200 p-4 space-y-2">
        <h2 className="text-sm font-semibold">Log rapide</h2>
        <div className="grid grid-cols-3 gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => addPreset(p)}
              disabled={saving}
              className="rounded-md bg-white border border-gray-300 px-2 py-2 text-xs hover:bg-gray-50 disabled:opacity-50"
            >
              {p.label}
            </button>
          ))}
        </div>
      </section>

      {/* Today entries */}
      {todayStats.count > 0 && (
        <section className="rounded-md border border-gray-200 p-4">
          <h2 className="text-sm font-semibold mb-2">Prises ({todayStats.count})</h2>
          <ul className="text-xs space-y-1">
            {(today?.entries ?? []).map((e, i) => (
              <li key={i} className="flex justify-between border-b last:border-b-0 py-1">
                <span className="text-gray-600">
                  {e.time} · {e.type.replace(/_/g, ' ')}
                </span>
                <span className="font-medium">
                  {e.quantity} {e.unit}
                </span>
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
                <th className="text-right py-1">☕ mg</th>
                <th className="text-right py-1">🍷 u</th>
                <th className="text-right py-1">🚬 u</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => {
                const e = h.entries ?? [];
                return (
                  <tr key={h.date} className="border-b last:border-b-0">
                    <td className="py-1.5 text-gray-600">{h.date}</td>
                    <td className="text-right py-1.5">{computeCaffeine(e)}</td>
                    <td className="text-right py-1.5">{computeAlcohol(e)}</td>
                    <td className="text-right py-1.5">{computeNicotine(e)}</td>
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
