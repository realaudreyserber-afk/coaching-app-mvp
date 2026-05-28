'use client';

/**
 * Page /progress/prs — Personal Records par exercice (lecture seule).
 *
 * Les PR sont détectés AUTOMATIQUEMENT à la fin de chaque workout_session
 * via /api/sessions/[id]/finish → detectPrsFromSession(). Pas d'ajout manuel
 * pour l'instant (peut être ajouté plus tard si besoin).
 *
 * Affiche pour chaque exo trackable :
 *   - Nom + nombre de PR
 *   - 1RM courant (estimation Epley)
 *   - Date du dernier PR
 *   - Liste historique des PR
 */

import { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/firebase/hooks';

interface PrEntryDoc {
  date: string;
  weight_kg: number;
  reps: number;
  estimated_1rm: number;
  source?: string;
  session_id?: string;
  notes?: string;
}

interface PrDoc {
  exercise_id: string;
  exercise_name: string;
  prs?: PrEntryDoc[];
  current_1rm?: number;
  last_pr_date?: string;
}

export default function PrsPage() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [prs, setPrs] = useState<PrDoc[]>([]);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [expandedExo, setExpandedExo] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, 'users', user.uid, 'prs'),
          orderBy('last_pr_date', 'desc'),
          limit(50),
        );
        const snap = await getDocs(q);
        if (cancelled) return;
        setPrs(snap.docs.map((d) => d.data() as PrDoc));
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

  if (authLoading || loading) return <div className="p-6">Chargement…</div>;
  if (!user) return <div className="p-6">Connexion requise.</div>;

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Personal Records</h1>
        <p className="text-sm text-gray-500">
          1RM estimés (formule Epley) à partir de tes séances loguées. Détection
          automatique sur les exos composés clés : squat, bench, deadlift, OHP,
          rowing, tractions, etc.
        </p>
      </header>

      {errorText && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {errorText}
        </div>
      )}

      {prs.length === 0 ? (
        <div className="rounded-md border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-600">
          Aucun PR détecté encore. Pour qu'un PR soit enregistré automatiquement, fais une
          séance loguée avec sets/reps/poids précis sur un exo composé (squat, bench, etc.)
          et clique "Finir la séance".
        </div>
      ) : (
        <div className="space-y-2">
          {prs.map((pr) => {
            const isExpanded = expandedExo === pr.exercise_id;
            const sorted = (pr.prs ?? []).sort((a, b) => (a.date > b.date ? -1 : 1));
            return (
              <div key={pr.exercise_id} className="rounded-md border border-gray-200">
                <button
                  type="button"
                  onClick={() => setExpandedExo(isExpanded ? null : pr.exercise_id)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50"
                >
                  <div>
                    <div className="font-semibold">{pr.exercise_name}</div>
                    <div className="text-xs text-gray-500">
                      {sorted.length} PR{sorted.length > 1 ? 's' : ''} · dernier :{' '}
                      {pr.last_pr_date ?? '?'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-700">{pr.current_1rm ?? 0} kg</div>
                    <div className="text-xs text-gray-500">1RM estimé</div>
                  </div>
                </button>
                {isExpanded && (
                  <div className="border-t border-gray-200 p-4 space-y-2 bg-gray-50">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-500 uppercase">
                          <th className="text-left py-1">Date</th>
                          <th className="text-right py-1">Poids × reps</th>
                          <th className="text-right py-1">1RM estimé</th>
                          <th className="text-right py-1">Source</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sorted.map((entry, i) => (
                          <tr key={i} className="border-t border-gray-200">
                            <td className="py-1">{entry.date}</td>
                            <td className="text-right py-1">
                              {entry.weight_kg} kg × {entry.reps}
                            </td>
                            <td className="text-right py-1 font-medium">
                              {entry.estimated_1rm} kg
                            </td>
                            <td className="text-right py-1 text-gray-500">
                              {entry.source === 'auto_from_session' ? 'auto' : 'manuel'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
