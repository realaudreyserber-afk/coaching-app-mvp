'use client';

/**
 * Page /hrv — log HRV / stress / RHR (manuel pour l'instant).
 *
 * HRV RMSSD en ms (depuis chest strap, montre, app dédiée).
 * Stress score 1-10 subjectif.
 * Resting HR au réveil.
 */

import { useEffect, useState } from 'react';
import { doc, setDoc, collection, query, orderBy, limit, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/firebase/hooks';

interface HrvLogDoc {
  date: string;
  hrv_rmssd?: number;
  stress_score?: number;
  resting_hr?: number;
  notes?: string;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function HrvPage() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [history, setHistory] = useState<HrvLogDoc[]>([]);

  // Form
  const [logDate, setLogDate] = useState(todayIso());
  const [hrv, setHrv] = useState('');
  const [stress, setStress] = useState(5);
  const [rhr, setRhr] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const snap = await getDocs(
          query(collection(db, 'users', user.uid, 'hrv_log'), orderBy('date', 'desc'), limit(28)),
        );
        if (cancelled) return;
        setHistory(snap.docs.map((d) => d.data() as HrvLogDoc));
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
    setSaving(true);
    setErrorText(null);
    try {
      const payload: HrvLogDoc & { updated_at?: unknown } = {
        date: logDate,
        stress_score: stress,
      };
      if (hrv) {
        const v = parseFloat(hrv);
        if (!Number.isNaN(v) && v > 0 && v < 300) payload.hrv_rmssd = v;
      }
      if (rhr) {
        const v = parseInt(rhr, 10);
        if (!Number.isNaN(v) && v >= 30 && v <= 130) payload.resting_hr = v;
      }
      if (notes.trim()) payload.notes = notes.trim().slice(0, 300);
      payload.updated_at = serverTimestamp();

      await setDoc(doc(db, 'users', user.uid, 'hrv_log', logDate), payload, { merge: true });
      setSavedAt(new Date().toLocaleTimeString());

      const snap = await getDocs(
        query(collection(db, 'users', user.uid, 'hrv_log'), orderBy('date', 'desc'), limit(28)),
      );
      setHistory(snap.docs.map((d) => d.data() as HrvLogDoc));
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
        <h1 className="text-2xl font-bold">HRV & stress</h1>
        <p className="text-sm text-gray-500">
          HRV RMSSD en ms (depuis montre / app). Stress subjectif 1-10. Resting HR au réveil.
          Impact training (deload), mental (cortisol), planning (long-terme).
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
            <label className="block text-xs font-medium text-gray-700 mb-1">HRV RMSSD (ms)</label>
            <input
              type="number"
              step="0.1"
              min={1}
              max={300}
              value={hrv}
              onChange={(e) => setHrv(e.target.value)}
              placeholder="Ex: 45"
              className="w-full rounded-md border border-gray-300 p-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Resting HR (bpm)</label>
            <input
              type="number"
              min={30}
              max={130}
              value={rhr}
              onChange={(e) => setRhr(e.target.value)}
              placeholder="Ex: 55"
              className="w-full rounded-md border border-gray-300 p-2 text-sm"
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-sm font-medium mb-1">
            <span>Stress subjectif</span>
            <span className="text-blue-700">{stress}/10</span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            value={stress}
            onChange={(e) => setStress(parseInt(e.target.value, 10))}
            className="w-full"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex: deadline pro lundi"
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
          <h2 className="text-sm font-semibold mb-2">Historique (28j)</h2>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 uppercase">
                <th className="text-left py-1">Date</th>
                <th className="text-right py-1">HRV (ms)</th>
                <th className="text-right py-1">RHR</th>
                <th className="text-right py-1">Stress</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.date} className="border-b last:border-b-0">
                  <td className="py-1.5 text-gray-600">{h.date}</td>
                  <td className="text-right py-1.5">{h.hrv_rmssd ?? '—'}</td>
                  <td className="text-right py-1.5">{h.resting_hr ?? '—'}</td>
                  <td className="text-right py-1.5">{h.stress_score ?? '—'}/10</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
