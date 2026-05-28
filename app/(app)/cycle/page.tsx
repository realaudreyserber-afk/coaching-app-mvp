'use client';

/**
 * Page /cycle — tracker du cycle menstruel.
 *
 * Affichée uniquement si profile.sex === 'female'. Sinon redirect / message.
 *
 * Fonctionnalités :
 *   - Form de log rapide pour aujourd'hui (flow + symptômes + notes)
 *   - Vue calendrier mensuelle avec marqueurs (jours règles, symptômes)
 *   - Section settings (longueur cycle, régularité, contraception hormonale)
 *
 * Stockage Firestore via client SDK (firestore.rules autorise owner direct).
 * Data alimente : NutritionCoach, MentalCoach, TrainingCoach, PlanningCoach.
 */

import { useEffect, useMemo, useState } from 'react';
import { doc, getDoc, setDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/firebase/hooks';

const SYMPTOM_OPTIONS: Array<{ key: string; label: string }> = [
  { key: 'cramps', label: 'Crampes / douleurs abdo' },
  { key: 'headache', label: 'Maux de tête' },
  { key: 'mood_low', label: 'Humeur basse' },
  { key: 'mood_irritable', label: 'Irritabilité' },
  { key: 'bloating', label: 'Ballonnements' },
  { key: 'breast_tenderness', label: 'Sensibilité poitrine' },
  { key: 'fatigue', label: 'Fatigue marquée' },
  { key: 'acne', label: 'Acné / peau' },
  { key: 'sleep_disrupted', label: 'Sommeil perturbé' },
  { key: 'cravings_sweet', label: 'Cravings sucré' },
  { key: 'cravings_salty', label: 'Cravings salé' },
  { key: 'libido_high', label: 'Libido haute' },
  { key: 'libido_low', label: 'Libido basse' },
  { key: 'energy_high', label: 'Énergie haute' },
  { key: 'energy_low', label: 'Énergie basse' },
];

const FLOW_LABELS = ['Aucun', 'Léger', 'Moyen', 'Abondant'];

const HORMONAL_TYPES: Array<{ key: string; label: string }> = [
  { key: 'pill_combined', label: 'Pilule combinée' },
  { key: 'pill_progestin', label: 'Pilule progestative' },
  { key: 'iud_hormonal', label: 'DIU hormonal (Mirena, etc.)' },
  { key: 'implant', label: 'Implant' },
  { key: 'ring', label: 'Anneau' },
  { key: 'patch', label: 'Patch' },
  { key: 'injection', label: 'Injection' },
  { key: 'other', label: 'Autre' },
];

interface CycleEntryDoc {
  date: string;
  phase?: string;
  symptoms?: string[];
  flow_intensity?: number;
  notes?: string;
  predicted?: boolean;
}

interface CycleSettingsDoc {
  avg_cycle_length_days?: number;
  avg_period_length_days?: number;
  regularity?: string;
  tracking_started_at?: string;
  hormonal_contraception?: {
    active: boolean;
    type?: string;
    start_date?: string;
  };
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoMonthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function buildMonthDays(year: number, month0: number): Array<{ iso: string; day: number; inMonth: boolean }> {
  // Builds a 6-week grid (42 cells) for the month, including padding from prev/next month.
  const first = new Date(year, month0, 1);
  const firstWeekday = (first.getDay() + 6) % 7; // Lundi = 0
  const startDate = new Date(year, month0, 1 - firstWeekday);
  const cells: Array<{ iso: string; day: number; inMonth: boolean }> = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    cells.push({
      iso: d.toISOString().slice(0, 10),
      day: d.getDate(),
      inMonth: d.getMonth() === month0,
    });
  }
  return cells;
}

export default function CyclePage() {
  const { user, loading: authLoading } = useAuth();
  const [profileSex, setProfileSex] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  // Today's entry state
  const [todayEntry, setTodayEntry] = useState<CycleEntryDoc>({
    date: todayIso(),
    symptoms: [],
    flow_intensity: 0,
    notes: '',
  });

  // Settings state
  const [settings, setSettings] = useState<CycleSettingsDoc>({
    avg_cycle_length_days: 28,
    avg_period_length_days: 5,
    regularity: 'unknown',
    hormonal_contraception: { active: false },
  });

  // Calendar state
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth()); // 0-indexed
  const [monthEntries, setMonthEntries] = useState<Record<string, CycleEntryDoc>>({});

  // Load profile sex + today entry + settings + month entries
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const userSnap = await getDoc(doc(db, 'users', user.uid));
        const sex = (userSnap.data()?.profile?.sex as string) ?? null;
        if (cancelled) return;
        setProfileSex(sex);
        if (sex !== 'female') {
          setLoading(false);
          return;
        }

        const [todaySnap, settingsSnap] = await Promise.all([
          getDoc(doc(db, 'users', user.uid, 'cycles', todayIso())),
          getDoc(doc(db, 'users', user.uid, 'cycle_settings', 'main')),
        ]);
        if (cancelled) return;

        if (todaySnap.exists()) {
          setTodayEntry({ ...(todaySnap.data() as CycleEntryDoc), date: todayIso() });
        }
        if (settingsSnap.exists()) {
          setSettings({ ...settings, ...(settingsSnap.data() as CycleSettingsDoc) });
        }

        await loadMonthEntries(user.uid, viewYear, viewMonth);
      } catch (e) {
        if (!cancelled) setErrorText(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, viewYear, viewMonth]);

  async function loadMonthEntries(uid: string, year: number, month0: number) {
    const monthStart = `${year}-${String(month0 + 1).padStart(2, '0')}-01`;
    const nextMonthStart = new Date(year, month0 + 1, 1).toISOString().slice(0, 10);
    const q = query(
      collection(db, 'users', uid, 'cycles'),
      where('date', '>=', monthStart),
      where('date', '<', nextMonthStart),
    );
    const snap = await getDocs(q);
    const byDate: Record<string, CycleEntryDoc> = {};
    snap.forEach((d) => {
      const data = d.data() as CycleEntryDoc;
      byDate[data.date] = data;
    });
    setMonthEntries(byDate);
  }

  async function saveTodayEntry() {
    if (!user) return;
    setSaving(true);
    setErrorText(null);
    try {
      await setDoc(
        doc(db, 'users', user.uid, 'cycles', todayEntry.date),
        { ...todayEntry, updated_at: serverTimestamp() },
        { merge: true },
      );
      setSavedAt(new Date().toLocaleTimeString());
      await loadMonthEntries(user.uid, viewYear, viewMonth);
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function saveSettings() {
    if (!user) return;
    setSaving(true);
    setErrorText(null);
    try {
      await setDoc(
        doc(db, 'users', user.uid, 'cycle_settings', 'main'),
        {
          ...settings,
          tracking_started_at: settings.tracking_started_at ?? new Date().toISOString(),
          updated_at: serverTimestamp(),
        },
        { merge: true },
      );
      setSavedAt(new Date().toLocaleTimeString());
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  function toggleSymptom(key: string) {
    setTodayEntry((prev) => {
      const cur = new Set(prev.symptoms ?? []);
      if (cur.has(key)) cur.delete(key);
      else cur.add(key);
      return { ...prev, symptoms: Array.from(cur) };
    });
  }

  const monthCells = useMemo(
    () => buildMonthDays(viewYear, viewMonth),
    [viewYear, viewMonth],
  );

  if (authLoading || loading) return <div className="p-6">Chargement…</div>;
  if (!user) return <div className="p-6">Connexion requise.</div>;
  if (profileSex !== 'female') {
    return (
      <div className="mx-auto max-w-2xl p-6 space-y-3">
        <h1 className="text-2xl font-bold">Suivi cycle</h1>
        <p className="text-sm text-gray-500">
          Cette page est conçue pour le suivi du cycle menstruel. Elle s'active
          automatiquement si <code>profile.sex</code> est défini à "female" dans tes paramètres.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Cycle</h1>
        <p className="text-sm text-gray-500">
          Tes données restent privées (owner only). Le coach les utilise pour adapter
          nutrition, training et accompagnement mental à ta phase actuelle.
        </p>
      </header>

      {errorText && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {errorText}
        </div>
      )}
      {savedAt && (
        <div className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-800">
          Sauvegardé à {savedAt}
        </div>
      )}

      {/* Log today */}
      <section className="space-y-4 rounded-md border border-gray-200 p-4">
        <h2 className="text-lg font-semibold">Aujourd'hui ({todayEntry.date})</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Flux</label>
          <div className="flex gap-2">
            {FLOW_LABELS.map((label, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setTodayEntry({ ...todayEntry, flow_intensity: i })}
                className={`px-3 py-1.5 rounded-md text-sm border ${
                  todayEntry.flow_intensity === i
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white border-gray-300 text-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Symptômes</label>
          <div className="flex flex-wrap gap-2">
            {SYMPTOM_OPTIONS.map((s) => {
              const active = (todayEntry.symptoms ?? []).includes(s.key);
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => toggleSymptom(s.key)}
                  className={`px-2.5 py-1 rounded-full text-xs border ${
                    active
                      ? 'bg-pink-100 border-pink-400 text-pink-800'
                      : 'bg-white border-gray-300 text-gray-600'
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            value={todayEntry.notes ?? ''}
            onChange={(e) => setTodayEntry({ ...todayEntry, notes: e.target.value })}
            className="w-full rounded-md border border-gray-300 p-2 text-sm min-h-[60px]"
            maxLength={500}
            placeholder="Note libre (max 500 caractères)"
          />
        </div>

        <button
          onClick={saveTodayEntry}
          disabled={saving}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? 'Sauvegarde…' : "Enregistrer aujourd'hui"}
        </button>
      </section>

      {/* Calendar */}
      <section className="space-y-3 rounded-md border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Calendrier</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                const d = new Date(viewYear, viewMonth - 1, 1);
                setViewYear(d.getFullYear());
                setViewMonth(d.getMonth());
              }}
              className="px-2 py-1 rounded-md border border-gray-300 text-sm"
            >
              ←
            </button>
            <span className="text-sm font-medium px-2 py-1">{isoMonthKey(new Date(viewYear, viewMonth, 1))}</span>
            <button
              type="button"
              onClick={() => {
                const d = new Date(viewYear, viewMonth + 1, 1);
                setViewYear(d.getFullYear());
                setViewMonth(d.getMonth());
              }}
              className="px-2 py-1 rounded-md border border-gray-300 text-sm"
            >
              →
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-xs">
          {['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'].map((d) => (
            <div key={d} className="text-center text-gray-500 font-semibold py-1">
              {d}
            </div>
          ))}
          {monthCells.map((cell) => {
            const entry = monthEntries[cell.iso];
            const hasFlow = entry && (entry.flow_intensity ?? 0) > 0;
            const hasSymptoms = entry && (entry.symptoms?.length ?? 0) > 0;
            return (
              <div
                key={cell.iso}
                className={`aspect-square rounded-md flex flex-col items-center justify-center text-xs border ${
                  cell.inMonth ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100 text-gray-400'
                } ${cell.iso === todayIso() ? 'ring-2 ring-blue-500' : ''}`}
                title={`${cell.iso}${entry?.symptoms?.length ? ' — ' + entry.symptoms.join(', ') : ''}`}
              >
                <span>{cell.day}</span>
                <div className="flex gap-0.5 mt-0.5">
                  {hasFlow && <span className="w-1.5 h-1.5 rounded-full bg-pink-500" />}
                  {hasSymptoms && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-gray-500">
          🔴 jour de règles · 🟡 symptômes loggés
        </p>
      </section>

      {/* Settings */}
      <section className="space-y-4 rounded-md border border-gray-200 p-4">
        <h2 className="text-lg font-semibold">Réglages</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Longueur moyenne du cycle (jours)
            </label>
            <input
              type="number"
              min={15}
              max={60}
              value={settings.avg_cycle_length_days ?? 28}
              onChange={(e) =>
                setSettings({ ...settings, avg_cycle_length_days: parseInt(e.target.value, 10) || 28 })
              }
              className="w-full rounded-md border border-gray-300 p-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Longueur moyenne des règles (jours)
            </label>
            <input
              type="number"
              min={1}
              max={15}
              value={settings.avg_period_length_days ?? 5}
              onChange={(e) =>
                setSettings({ ...settings, avg_period_length_days: parseInt(e.target.value, 10) || 5 })
              }
              className="w-full rounded-md border border-gray-300 p-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Régularité</label>
          <select
            value={settings.regularity ?? 'unknown'}
            onChange={(e) => setSettings({ ...settings, regularity: e.target.value })}
            className="w-full rounded-md border border-gray-300 p-2 text-sm"
          >
            <option value="regular">Régulier</option>
            <option value="irregular">Irrégulier</option>
            <option value="unknown">Je ne sais pas</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.hormonal_contraception?.active ?? false}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  hormonal_contraception: {
                    ...settings.hormonal_contraception,
                    active: e.target.checked,
                  },
                })
              }
            />
            Contraception hormonale active
          </label>
          {settings.hormonal_contraception?.active && (
            <select
              value={settings.hormonal_contraception?.type ?? ''}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  hormonal_contraception: {
                    ...settings.hormonal_contraception,
                    active: true,
                    type: e.target.value,
                  },
                })
              }
              className="w-full rounded-md border border-gray-300 p-2 text-sm"
            >
              <option value="">— Type —</option>
              {HORMONAL_TYPES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          )}
        </div>

        <button
          onClick={saveSettings}
          disabled={saving}
          className="rounded-md bg-gray-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? 'Sauvegarde…' : 'Enregistrer les réglages'}
        </button>
      </section>
    </div>
  );
}
