'use client';

/**
 * Page /sleep — log sommeil détaillé (manuel pour l'instant).
 *
 * Quand un wearable enverra sleep stages/awakenings, on agrégera auto.
 * Pour l'instant : form simple pour saisir hier soir.
 */

import { useEffect, useState } from 'react';
import { doc, setDoc, collection, query, orderBy, limit, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/firebase/hooks';

interface SleepLogDoc {
  date: string;
  sleep_hours?: number;
  deep_pct?: number;
  rem_pct?: number;
  awakenings?: number;
  quality?: number;
  bedtime?: string;
  notes?: string;
}

function yesterdayIso(): string {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export default function SleepPage() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [history, setHistory] = useState<SleepLogDoc[]>([]);

  // Form (defaults : hier soir)
  const [logDate, setLogDate] = useState(yesterdayIso());
  const [hours, setHours] = useState('');
  const [quality, setQuality] = useState(7);
  const [bedtime, setBedtime] = useState('');
  const [awakenings, setAwakenings] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const snap = await getDocs(
          query(collection(db, 'users', user.uid, 'sleep_log'), orderBy('date', 'desc'), limit(14)),
        );
        if (cancelled) return;
        setHistory(snap.docs.map((d) => d.data() as SleepLogDoc));
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

  async function save() {
    if (!user) return;
    const h = parseFloat(hours);
    if (Number.isNaN(h) || h < 0 || h > 24) {
      setErrorText('Heures de sommeil invalides.');
      return;
    }
    setSaving(true);
    setErrorText(null);
    try {
      const payload: SleepLogDoc & { updated_at?: unknown } = {
        date: logDate,
        sleep_hours: h,
        quality: quality,
      };
      if (bedtime) payload.bedtime = bedtime;
      if (awakenings) {
        const a = parseInt(awakenings, 10);
        if (!Number.isNaN(a) && a >= 0) payload.awakenings = a;
      }
      if (notes.trim()) payload.notes = notes.trim().slice(0, 300);
      payload.updated_at = serverTimestamp();

      await setDoc(doc(db, 'users', user.uid, 'sleep_log', logDate), payload, { merge: true });
      setSavedAt(new Date().toLocaleTimeString());

      const snap = await getDocs(
        query(collection(db, 'users', user.uid, 'sleep_log'), orderBy('date', 'desc'), limit(14)),
      );
      setHistory(snap.docs.map((d) => d.data() as SleepLogDoc));
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || loading) return <div className="p-6">Chargement…</div>;
  if (!user) return <div className="p-6">Connexion requise.</div>;

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Sommeil</h1>
        <p className="text-sm text-gray-500">
          Log manuel pour l'instant. Impact training (récup), mental (cortisol), nutrition (cravings).
        </p>
      </header>

      {errorText && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">{errorText}</div>
      )}
      {savedAt && (
        <div className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-800">
          Sauvegardé à {savedAt}
        </div>
      )}

      <section className="rounded-md border border-gray-200 p-4 space-y-3">
        <h2 className="text-lg font-semibold">Nouveau log</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={logDate}
              onChange={(e) => setLogDate(e.target.value)}
              className="w-full rounded-md border border-gray-300 p-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Heures de sommeil</label>
            <input
              type="number"
              step="0.25"
              min={0}
              max={24}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="Ex: 7.5"
              className="w-full rounded-md border border-gray-300 p-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Heure du coucher (optionnel)</label>
            <input
              type="time"
              value={bedtime}
              onChange={(e) => setBedtime(e.target.value)}
              className="w-full rounded-md border border-gray-300 p-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Réveils nocturnes (optionnel)</label>
            <input
              type="number"
              min={0}
              max={20}
              value={awakenings}
              onChange={(e) => setAwakenings(e.target.value)}
              className="w-full rounded-md border border-gray-300 p-2 text-sm"
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-sm font-medium mb-1">
            <span>Qualité ressentie</span>
            <span className="text-blue-700">{quality}/10</span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            value={quality}
            onChange={(e) => setQuality(parseInt(e.target.value, 10))}
            className="w-full"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex: réveillé à 3h, retombé difficile"
            className="w-full rounded-md border border-gray-300 p-2 text-sm min-h-[50px]"
            maxLength={300}
          />
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? 'Sauvegarde…' : 'Enregistrer'}
        </button>
      </section>

      {history.length > 0 && (
        <section className="rounded-md border border-gray-200 p-4">
          <h2 className="text-sm font-semibold mb-2">Historique (14j)</h2>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 uppercase">
                <th className="text-left py-1">Date</th>
                <th className="text-right py-1">Heures</th>
                <th className="text-right py-1">Qualité</th>
                <th className="text-right py-1">Réveils</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.date} className="border-b last:border-b-0">
                  <td className="py-1.5 text-gray-600">{h.date}</td>
                  <td className={`text-right py-1.5 ${h.sleep_hours && h.sleep_hours < 6 ? 'text-amber-700 font-medium' : ''}`}>
                    {h.sleep_hours ?? '—'}
                  </td>
                  <td className="text-right py-1.5">{h.quality ?? '—'}/10</td>
                  <td className="text-right py-1.5">{h.awakenings ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
