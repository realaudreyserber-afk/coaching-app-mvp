'use client';

/**
 * Page /progress/measurements — tracker mensurations corporelles évolutives.
 *
 * Fix du bug data : avant, profile.waist_cm etc. = unique valeur (l'historique
 * était perdu). Maintenant, chaque mesure est un doc dans
 * users/{uid}/measurements/{YYYY-MM-DD}.
 *
 * Fonctionnalités :
 *   - Form de saisie pour aujourd'hui (champs optionnels — on peut juste mesurer waist)
 *   - Table des derniers entries avec delta vs précédent
 *   - Tendances 30j et 90j par mesure
 *
 * profile.*_cm reste mirror du dernier pour compat. Source de vérité = collection.
 */

import { useEffect, useMemo, useState } from 'react';
import { doc, setDoc, collection, query, orderBy, limit, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/firebase/hooks';

const FIELDS: Array<{ key: string; label: string; min: number; max: number; unit: string }> = [
  { key: 'waist_cm', label: 'Tour de taille (nombril, expiration)', min: 40, max: 200, unit: 'cm' },
  { key: 'neck_cm', label: 'Tour de cou (sous pomme d\'Adam)', min: 25, max: 70, unit: 'cm' },
  { key: 'hips_cm', label: 'Tour de hanches', min: 50, max: 200, unit: 'cm' },
  { key: 'shoulder_cm', label: 'Largeur d\'épaules', min: 90, max: 180, unit: 'cm' },
  { key: 'chest_cm', label: 'Tour de poitrine', min: 60, max: 180, unit: 'cm' },
  { key: 'arm_cm', label: 'Tour de bras (contracté)', min: 20, max: 65, unit: 'cm' },
  { key: 'forearm_cm', label: 'Tour d\'avant-bras', min: 15, max: 50, unit: 'cm' },
  { key: 'wrist_cm', label: 'Tour de poignet', min: 10, max: 25, unit: 'cm' },
  { key: 'thigh_cm', label: 'Tour de cuisse', min: 30, max: 100, unit: 'cm' },
  { key: 'calf_cm', label: 'Tour de mollet', min: 20, max: 60, unit: 'cm' },
];

interface MeasurementEntryDoc {
  date: string;
  source?: string;
  waist_cm?: number;
  neck_cm?: number;
  hips_cm?: number;
  shoulder_cm?: number;
  chest_cm?: number;
  arm_cm?: number;
  forearm_cm?: number;
  wrist_cm?: number;
  thigh_cm?: number;
  calf_cm?: number;
  weight_kg?: number;
  notes?: string;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function MeasurementsPage() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [weightKg, setWeightKg] = useState<string>('');
  const [history, setHistory] = useState<MeasurementEntryDoc[]>([]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, 'users', user.uid, 'measurements'),
          orderBy('date', 'desc'),
          limit(30),
        );
        const snap = await getDocs(q);
        if (cancelled) return;
        const entries: MeasurementEntryDoc[] = snap.docs.map((d) => d.data() as MeasurementEntryDoc);
        setHistory(entries);
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
      const payload: MeasurementEntryDoc = { date: todayIso(), source: 'self' };
      for (const f of FIELDS) {
        const raw = formValues[f.key];
        if (raw && raw.trim() !== '') {
          const num = parseFloat(raw);
          if (!Number.isNaN(num) && num >= f.min && num <= f.max) {
            (payload as unknown as Record<string, unknown>)[f.key] = num;
          }
        }
      }
      if (weightKg.trim() !== '') {
        const w = parseFloat(weightKg);
        if (!Number.isNaN(w) && w >= 30 && w <= 300) payload.weight_kg = w;
      }
      if (notes.trim() !== '') payload.notes = notes.trim().slice(0, 500);

      // Doit avoir au moins UN champ rempli
      const hasMeasure = FIELDS.some((f) => (payload as unknown as Record<string, unknown>)[f.key] !== undefined);
      if (!hasMeasure) {
        setErrorText('Renseigne au moins une mesure avant d\'enregistrer.');
        setSaving(false);
        return;
      }

      await setDoc(
        doc(db, 'users', user.uid, 'measurements', payload.date),
        { ...payload, updated_at: serverTimestamp() },
        { merge: true },
      );
      setSavedAt(new Date().toLocaleTimeString());

      // Reload history
      const q = query(
        collection(db, 'users', user.uid, 'measurements'),
        orderBy('date', 'desc'),
        limit(30),
      );
      const snap = await getDocs(q);
      setHistory(snap.docs.map((d) => d.data() as MeasurementEntryDoc));

      // Reset form
      setFormValues({});
      setWeightKg('');
      setNotes('');
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  // Compute trends 30/90 days per field
  const trends = useMemo(() => {
    if (history.length < 2) return {} as Record<string, { latest: number; delta30: number | null; delta90: number | null }>;
    const sorted = [...history].sort((a, b) => (a.date < b.date ? -1 : 1)); // asc
    const latest = sorted[sorted.length - 1];
    const latestT = new Date(latest.date).getTime();

    function findClosestBefore(daysBack: number): MeasurementEntryDoc | null {
      const targetT = latestT - daysBack * 24 * 60 * 60 * 1000;
      let best: MeasurementEntryDoc | null = null;
      for (const e of sorted) {
        if (new Date(e.date).getTime() <= targetT) best = e;
        else break;
      }
      return best;
    }

    const ref30 = findClosestBefore(30);
    const ref90 = findClosestBefore(90);

    const out: Record<string, { latest: number; delta30: number | null; delta90: number | null }> = {};
    for (const f of FIELDS) {
      const latestVal = (latest as unknown as Record<string, unknown>)[f.key];
      if (typeof latestVal !== 'number') continue;
      const v30 = ref30 ? (ref30 as unknown as Record<string, unknown>)[f.key] : undefined;
      const v90 = ref90 ? (ref90 as unknown as Record<string, unknown>)[f.key] : undefined;
      out[f.key] = {
        latest: latestVal,
        delta30: typeof v30 === 'number' ? Math.round((latestVal - v30) * 100) / 100 : null,
        delta90: typeof v90 === 'number' ? Math.round((latestVal - v90) * 100) / 100 : null,
      };
    }
    return out;
  }, [history]);

  if (authLoading || loading) return <div className="p-6">Chargement…</div>;
  if (!user) return <div className="p-6">Connexion requise.</div>;

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Mensurations</h1>
        <p className="text-sm text-gray-500">
          Chaque mesure est sauvée avec sa date. Tu peux remplir seulement les champs que tu mesures
          ce jour-là — les autres ne sont pas touchés.
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

      {/* Form */}
      <section className="space-y-4 rounded-md border border-gray-200 p-4">
        <h2 className="text-lg font-semibold">Nouvelle mesure ({todayIso()})</h2>
        <div className="grid grid-cols-2 gap-3">
          {FIELDS.map((f) => (
            <div key={f.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
              <div className="flex">
                <input
                  type="number"
                  step="0.1"
                  min={f.min}
                  max={f.max}
                  value={formValues[f.key] ?? ''}
                  onChange={(e) => setFormValues({ ...formValues, [f.key]: e.target.value })}
                  className="w-full rounded-l-md border border-gray-300 p-2 text-sm"
                  placeholder={`${f.min}-${f.max}`}
                />
                <span className="inline-flex items-center px-2 text-sm border border-l-0 border-gray-300 rounded-r-md bg-gray-50 text-gray-500">
                  {f.unit}
                </span>
              </div>
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Poids du jour (optionnel)</label>
            <div className="flex">
              <input
                type="number"
                step="0.1"
                min={30}
                max={300}
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                className="w-full rounded-l-md border border-gray-300 p-2 text-sm"
                placeholder="30-300"
              />
              <span className="inline-flex items-center px-2 text-sm border border-l-0 border-gray-300 rounded-r-md bg-gray-50 text-gray-500">
                kg
              </span>
            </div>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optionnel)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-md border border-gray-300 p-2 text-sm min-h-[60px]"
            maxLength={500}
            placeholder="Ex: mesure matin à jeun, ruban serré"
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

      {/* Trends */}
      {Object.keys(trends).length > 0 && (
        <section className="space-y-3 rounded-md border border-gray-200 p-4">
          <h2 className="text-lg font-semibold">Tendances</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs uppercase text-gray-500">
                <th className="text-left py-2">Mesure</th>
                <th className="text-right py-2">Actuel</th>
                <th className="text-right py-2">Δ 30j</th>
                <th className="text-right py-2">Δ 90j</th>
              </tr>
            </thead>
            <tbody>
              {FIELDS.map((f) => {
                const t = trends[f.key];
                if (!t) return null;
                const renderDelta = (d: number | null) => {
                  if (d === null) return <span className="text-gray-400">—</span>;
                  const sign = d > 0 ? '+' : '';
                  const cls = d > 0 ? 'text-amber-700' : d < 0 ? 'text-green-700' : 'text-gray-500';
                  return <span className={cls}>{sign}{d} cm</span>;
                };
                return (
                  <tr key={f.key} className="border-b last:border-b-0">
                    <td className="py-2 text-gray-700">{f.label}</td>
                    <td className="text-right py-2 font-medium">{t.latest} cm</td>
                    <td className="text-right py-2">{renderDelta(t.delta30)}</td>
                    <td className="text-right py-2">{renderDelta(t.delta90)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="text-xs text-gray-500">
            Vert = baisse (souvent souhaitée), ambre = hausse. Pour le tour d'épaules / bras / poitrine,
            une hausse peut être positive (croissance musculaire).
          </p>
        </section>
      )}

      {/* History table */}
      {history.length > 0 && (
        <section className="space-y-3 rounded-md border border-gray-200 p-4">
          <h2 className="text-lg font-semibold">Historique ({history.length})</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b text-xs uppercase text-gray-500">
                  <th className="text-left py-2 pr-3">Date</th>
                  <th className="text-right py-2 px-2">Taille</th>
                  <th className="text-right py-2 px-2">Cou</th>
                  <th className="text-right py-2 px-2">Hanches</th>
                  <th className="text-right py-2 px-2">Épaules</th>
                  <th className="text-right py-2 px-2">Bras</th>
                  <th className="text-right py-2 px-2">Cuisse</th>
                  <th className="text-right py-2 pl-2">Poids</th>
                </tr>
              </thead>
              <tbody>
                {history.map((e) => (
                  <tr key={e.date} className="border-b last:border-b-0">
                    <td className="py-1.5 pr-3 text-gray-600">{e.date}</td>
                    <td className="text-right py-1.5 px-2">{e.waist_cm ?? '—'}</td>
                    <td className="text-right py-1.5 px-2">{e.neck_cm ?? '—'}</td>
                    <td className="text-right py-1.5 px-2">{e.hips_cm ?? '—'}</td>
                    <td className="text-right py-1.5 px-2">{e.shoulder_cm ?? '—'}</td>
                    <td className="text-right py-1.5 px-2">{e.arm_cm ?? '—'}</td>
                    <td className="text-right py-1.5 px-2">{e.thigh_cm ?? '—'}</td>
                    <td className="text-right py-1.5 pl-2">{e.weight_kg ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
