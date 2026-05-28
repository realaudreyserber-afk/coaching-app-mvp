'use client';

/**
 * Page /settings/dietary — préférences alimentaires + allergies + dégoûts.
 *
 * Phase 9 data-layer. Stocké dans users/{uid}.profile.{dietary_preferences,
 * allergies, dislikes}.
 *
 * Critique pour NutritionCoach : sans ça, il propose du saumon à un
 * végétarien et des arachides à un allergique.
 */

import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/firebase/hooks';

const DIETARY_PREFERENCES = [
  { key: 'vegetarian', label: 'Végétarien' },
  { key: 'vegan', label: 'Végan' },
  { key: 'pescetarian', label: 'Pescétarien' },
  { key: 'halal', label: 'Halal' },
  { key: 'kosher', label: 'Casher' },
  { key: 'gluten_free', label: 'Sans gluten' },
  { key: 'lactose_free', label: 'Sans lactose' },
  { key: 'low_fodmap', label: 'Low FODMAP' },
  { key: 'keto', label: 'Cétogène' },
];

export default function DietaryPage() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const [preferences, setPreferences] = useState<string[]>([]);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [dislikes, setDislikes] = useState<string[]>([]);
  const [allergyInput, setAllergyInput] = useState('');
  const [dislikeInput, setDislikeInput] = useState('');

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (cancelled) return;
        const profile = snap.data()?.profile ?? {};
        if (Array.isArray(profile.dietary_preferences)) setPreferences(profile.dietary_preferences);
        if (Array.isArray(profile.allergies)) setAllergies(profile.allergies);
        if (Array.isArray(profile.dislikes)) setDislikes(profile.dislikes);
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
      await setDoc(
        doc(db, 'users', user.uid),
        {
          profile: {
            dietary_preferences: preferences,
            allergies,
            dislikes,
          },
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

  function togglePreference(key: string) {
    const s = new Set(preferences);
    if (s.has(key)) s.delete(key);
    else s.add(key);
    setPreferences(Array.from(s));
  }

  function addAllergy() {
    const v = allergyInput.trim();
    if (!v || allergies.includes(v) || allergies.length >= 20) return;
    setAllergies([...allergies, v.slice(0, 50)]);
    setAllergyInput('');
  }

  function addDislike() {
    const v = dislikeInput.trim();
    if (!v || dislikes.includes(v) || dislikes.length >= 30) return;
    setDislikes([...dislikes, v.slice(0, 50)]);
    setDislikeInput('');
  }

  if (authLoading || loading) return <div className="p-6">Chargement…</div>;
  if (!user) return <div className="p-6">Connexion requise.</div>;

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Préférences alimentaires</h1>
        <p className="text-sm text-gray-500">
          Le coach ne propose jamais d'aliments que tu exclus. Tes allergies sont
          respectées en strict. Tes dégoûts sont évités quand possible.
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

      {/* Preferences */}
      <section className="rounded-md border border-gray-200 p-4 space-y-2">
        <h2 className="text-lg font-semibold">Régime alimentaire</h2>
        <div className="flex flex-wrap gap-1.5">
          {DIETARY_PREFERENCES.map((p) => {
            const active = preferences.includes(p.key);
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => togglePreference(p.key)}
                className={`px-2.5 py-1 rounded-full text-xs border ${
                  active ? 'bg-green-100 border-green-400 text-green-800' : 'bg-white border-gray-300 text-gray-600'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Allergies */}
      <section className="rounded-md border border-gray-200 p-4 space-y-2">
        <h2 className="text-lg font-semibold">Allergies / intolérances</h2>
        <p className="text-xs text-gray-500">Respectées en strict — jamais proposé.</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={allergyInput}
            onChange={(e) => setAllergyInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addAllergy()}
            placeholder="Ex: arachides, lait, crustacés…"
            maxLength={50}
            className="flex-1 rounded-md border border-gray-300 p-2 text-sm"
          />
          <button
            type="button"
            onClick={addAllergy}
            className="px-3 py-2 text-sm rounded-md bg-red-600 text-white"
          >
            +
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {allergies.map((a) => (
            <span
              key={a}
              className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-800 border border-red-300 flex items-center gap-1"
            >
              {a}
              <button
                type="button"
                onClick={() => setAllergies(allergies.filter((x) => x !== a))}
                className="text-red-600 hover:text-red-900"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </section>

      {/* Dislikes */}
      <section className="rounded-md border border-gray-200 p-4 space-y-2">
        <h2 className="text-lg font-semibold">Dégoûts</h2>
        <p className="text-xs text-gray-500">Évités quand alternatives possibles.</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={dislikeInput}
            onChange={(e) => setDislikeInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addDislike()}
            placeholder="Ex: chou-fleur, foie, betterave…"
            maxLength={50}
            className="flex-1 rounded-md border border-gray-300 p-2 text-sm"
          />
          <button
            type="button"
            onClick={addDislike}
            className="px-3 py-2 text-sm rounded-md bg-gray-700 text-white"
          >
            +
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {dislikes.map((d) => (
            <span
              key={d}
              className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700 border border-gray-300 flex items-center gap-1"
            >
              {d}
              <button
                type="button"
                onClick={() => setDislikes(dislikes.filter((x) => x !== d))}
                className="text-gray-600 hover:text-gray-900"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </section>

      <button
        onClick={save}
        disabled={saving}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {saving ? 'Sauvegarde…' : 'Enregistrer'}
      </button>
    </div>
  );
}
