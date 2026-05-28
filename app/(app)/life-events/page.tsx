'use client';

/**
 * Page /life-events — log événements de vie impactant le coaching.
 *
 * Form add nouveau + liste actifs + historique. Les agents (mental, planning,
 * safety) adaptent leur ton en fonction.
 */

import { useEffect, useState } from 'react';
import { collection, query, orderBy, getDocs, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/firebase/hooks';
import { useConfirm } from '@/components/ui/confirm-dialog';

const TYPES: Array<{ key: string; label: string }> = [
  { key: 'move', label: 'Déménagement' },
  { key: 'breakup', label: 'Rupture / divorce' },
  { key: 'work_change', label: 'Changement pro' },
  { key: 'work_stress', label: 'Surcharge pro / burnout' },
  { key: 'loss', label: 'Deuil' },
  { key: 'travel', label: 'Voyage long' },
  { key: 'injury', label: 'Blessure' },
  { key: 'illness', label: 'Maladie' },
  { key: 'family', label: 'Événement familial' },
  { key: 'financial', label: 'Stress financier' },
  { key: 'positive', label: 'Événement positif' },
  { key: 'other', label: 'Autre' },
];

const SEVERITIES = [
  { key: 'low', label: 'Faible' },
  { key: 'medium', label: 'Modéré' },
  { key: 'high', label: 'Élevé' },
];

const IMPACT_AREAS = [
  { key: 'sleep', label: 'Sommeil' },
  { key: 'eating', label: 'Alimentation' },
  { key: 'training', label: 'Training' },
  { key: 'mental', label: 'Mental' },
  { key: 'social', label: 'Social' },
  { key: 'energy', label: 'Énergie' },
];

interface LifeEventDoc {
  id: string;
  type: string;
  severity: string;
  description: string;
  date_start: string;
  date_end?: string;
  expected_impact_areas?: string[];
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function LifeEventsPage() {
  const { user, loading: authLoading } = useAuth();
  const confirm = useConfirm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [events, setEvents] = useState<LifeEventDoc[]>([]);

  // Form
  const [formType, setFormType] = useState('work_stress');
  const [formSeverity, setFormSeverity] = useState('medium');
  const [formDateStart, setFormDateStart] = useState(todayIso());
  const [formDateEnd, setFormDateEnd] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formImpactAreas, setFormImpactAreas] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, 'users', user.uid, 'life_events'),
          orderBy('date_start', 'desc'),
        );
        const snap = await getDocs(q);
        if (cancelled) return;
        setEvents(snap.docs.map((d) => ({ ...(d.data() as LifeEventDoc), id: d.id })));
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

  async function addEvent() {
    if (!user) return;
    if (!formDescription.trim()) {
      setErrorText('Description requise.');
      return;
    }
    setSaving(true);
    setErrorText(null);
    try {
      const payload: Omit<LifeEventDoc, 'id'> & { created_at?: unknown; updated_at?: unknown } = {
        type: formType,
        severity: formSeverity,
        description: formDescription.trim().slice(0, 500),
        date_start: formDateStart,
        expected_impact_areas: formImpactAreas,
      };
      if (formDateEnd) payload.date_end = formDateEnd;
      payload.created_at = serverTimestamp();
      payload.updated_at = serverTimestamp();

      const docRef = await addDoc(collection(db, 'users', user.uid, 'life_events'), payload);
      const newEvent: LifeEventDoc = {
        ...payload,
        id: docRef.id,
      } as LifeEventDoc;
      setEvents([newEvent, ...events]);

      // Reset form
      setFormDescription('');
      setFormImpactAreas([]);
      setFormDateEnd('');
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function removeEvent(eventId: string) {
    if (!user) return;
    if (!(await confirm({
      title: 'Supprimer l\'événement',
      message: 'Confirmer la suppression de cet événement ?',
      confirmLabel: 'Supprimer',
      danger: true,
    }))) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'life_events', eventId));
      setEvents(events.filter((e) => e.id !== eventId));
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : String(e));
    }
  }

  function toggleImpactArea(area: string) {
    const s = new Set(formImpactAreas);
    if (s.has(area)) s.delete(area);
    else s.add(area);
    setFormImpactAreas(Array.from(s));
  }

  if (authLoading || loading) return <div className="p-6">Chargement…</div>;
  if (!user) return <div className="p-6">Connexion requise.</div>;

  const today = todayIso();
  const active = events.filter((e) => e.date_start <= today && (!e.date_end || e.date_end >= today));
  const past = events.filter((e) => e.date_end && e.date_end < today);

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Événements de vie</h1>
        <p className="text-sm text-gray-500">
          Contexte que le coach n'a pas autrement. Déménagement, rupture, burnout, voyage long,
          blessure — tout ce qui change ta capacité à suivre le plan.
        </p>
      </header>

      {errorText && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {errorText}
        </div>
      )}

      {/* Form */}
      <section className="rounded-md border border-gray-200 p-4 space-y-3">
        <h2 className="text-lg font-semibold">Nouvel événement</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={formType}
              onChange={(e) => setFormType(e.target.value)}
              className="w-full rounded-md border border-gray-300 p-2 text-sm"
            >
              {TYPES.map((t) => (
                <option key={t.key} value={t.key}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sévérité</label>
            <select
              value={formSeverity}
              onChange={(e) => setFormSeverity(e.target.value)}
              className="w-full rounded-md border border-gray-300 p-2 text-sm"
            >
              {SEVERITIES.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date début</label>
            <input
              type="date"
              value={formDateStart}
              onChange={(e) => setFormDateStart(e.target.value)}
              className="w-full rounded-md border border-gray-300 p-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date fin (optionnel)</label>
            <input
              type="date"
              value={formDateEnd}
              onChange={(e) => setFormDateEnd(e.target.value)}
              className="w-full rounded-md border border-gray-300 p-2 text-sm"
              placeholder="Laisser vide si en cours"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            placeholder="Ex: déménagement Paris → Lyon, je suis pris cette semaine"
            maxLength={500}
            className="w-full rounded-md border border-gray-300 p-2 text-sm min-h-[60px]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Zones impactées</label>
          <div className="flex flex-wrap gap-1.5">
            {IMPACT_AREAS.map((a) => {
              const active = formImpactAreas.includes(a.key);
              return (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => toggleImpactArea(a.key)}
                  className={`px-2 py-1 rounded-full text-xs border ${
                    active ? 'bg-blue-100 border-blue-400 text-blue-800' : 'bg-white border-gray-300 text-gray-600'
                  }`}
                >
                  {a.label}
                </button>
              );
            })}
          </div>
        </div>
        <button
          onClick={addEvent}
          disabled={saving}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? 'Ajout…' : 'Ajouter'}
        </button>
      </section>

      {/* Active */}
      {active.length > 0 && (
        <section className="rounded-md border border-blue-300 bg-blue-50 p-4 space-y-2">
          <h2 className="text-lg font-semibold">En cours ({active.length})</h2>
          {active.map((e) => (
            <EventCard key={e.id} event={e} onDelete={() => removeEvent(e.id)} types={TYPES} />
          ))}
        </section>
      )}

      {/* Past */}
      {past.length > 0 && (
        <section className="rounded-md border border-gray-200 p-4 space-y-2">
          <h2 className="text-lg font-semibold">Historique ({past.length})</h2>
          {past.map((e) => (
            <EventCard key={e.id} event={e} onDelete={() => removeEvent(e.id)} types={TYPES} />
          ))}
        </section>
      )}
    </div>
  );
}

function EventCard({
  event,
  onDelete,
  types,
}: {
  event: LifeEventDoc;
  onDelete: () => void;
  types: Array<{ key: string; label: string }>;
}) {
  const typeLabel = types.find((t) => t.key === event.type)?.label ?? event.type;
  const severityBadge = {
    low: 'bg-gray-100 text-gray-700',
    medium: 'bg-amber-100 text-amber-800',
    high: 'bg-red-100 text-red-800',
  }[event.severity] ?? 'bg-gray-100 text-gray-700';
  return (
    <div className="flex justify-between items-start bg-white rounded-md border border-gray-200 p-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm">{typeLabel}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded ${severityBadge}`}>{event.severity}</span>
        </div>
        <div className="text-xs text-gray-500 mt-0.5">
          {event.date_start}
          {event.date_end ? ` → ${event.date_end}` : ' → en cours'}
        </div>
        <p className="text-sm mt-1.5 text-gray-700">{event.description}</p>
        {event.expected_impact_areas && event.expected_impact_areas.length > 0 && (
          <div className="flex gap-1 mt-1.5">
            {event.expected_impact_areas.map((a) => (
              <span key={a} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                {a}
              </span>
            ))}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onDelete}
        className="text-xs text-red-600 hover:underline ml-2 shrink-0"
      >
        Supprimer
      </button>
    </div>
  );
}
