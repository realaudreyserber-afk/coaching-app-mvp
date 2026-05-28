'use client';

/**
 * Page /progress/photos — gallery chronologique des photos de progression.
 *
 * Lit la collection existante `users/{uid}/photos/*` (peuplée par les routes
 * /api/ai/analyze-photo et /scanner). Affiche grille chronologique + détails
 * BF estimé si dispo.
 *
 * Pour AJOUTER une photo, l'user doit passer par /scanner (existant) qui
 * lance l'analyse vision IA. On ne duplique pas le flow d'upload ici.
 */

import { useEffect, useState } from 'react';
import { collection, query, orderBy, getDocs, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/firebase/hooks';
import Link from 'next/link';

interface PhotoDoc {
  id: string;
  date?: string;
  type?: string;
  storage_path?: string;
  bf_estimated?: number;
  quality_score?: number;
  created_at?: string;
}

export default function ProgressPhotosPage() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<PhotoDoc[]>([]);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // Audit 2026-05-28 #20 : query non bornée → téléchargeait tout
        // l'historique photos à chaque visite. Cap à 60 (≈ 1 an de photos
        // hebdo) ; pagination à prévoir si besoin au-delà.
        const q = query(
          collection(db, 'users', user.uid, 'photos'),
          orderBy('date', 'desc'),
          limit(60),
        );
        const snap = await getDocs(q);
        if (cancelled) return;
        setPhotos(snap.docs.map((d) => ({ ...(d.data() as PhotoDoc), id: d.id })));
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

  // Group photos by month for chronological visualization
  const byMonth: Record<string, PhotoDoc[]> = {};
  for (const p of photos) {
    const monthKey = (p.date ?? p.created_at ?? '').slice(0, 7) || 'inconnu';
    if (!byMonth[monthKey]) byMonth[monthKey] = [];
    byMonth[monthKey].push(p);
  }
  const months = Object.keys(byMonth).sort((a, b) => (a < b ? 1 : -1));

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Photos de progression</h1>
        <p className="text-sm text-gray-500">
          Pour ajouter une nouvelle photo, utilise le <Link href="/scanner" className="text-blue-600 underline">Scanner</Link>{' '}
          qui analyse la composition. Cette page affiche ta chronologie.
        </p>
      </header>

      {errorText && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {errorText}
        </div>
      )}

      {photos.length === 0 ? (
        <div className="rounded-md border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-600">
          Aucune photo encore. Va sur <Link href="/scanner" className="text-blue-600 underline">/scanner</Link> pour en prendre une.
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-md border border-gray-200 p-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-2xl font-bold">{photos.length}</div>
                <div className="text-xs text-gray-500">photos</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{months.length}</div>
                <div className="text-xs text-gray-500">mois couverts</div>
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {photos[0]?.bf_estimated !== undefined ? `${photos[0].bf_estimated}%` : '—'}
                </div>
                <div className="text-xs text-gray-500">BF récent estimé</div>
              </div>
            </div>
          </div>

          {months.map((month) => {
            const items = byMonth[month];
            return (
              <section key={month} className="space-y-2">
                <h2 className="text-sm font-semibold text-gray-700">{month}</h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {items.map((p) => (
                    <div
                      key={p.id}
                      className="rounded-md border border-gray-200 overflow-hidden bg-white"
                    >
                      {p.storage_path ? (
                        <div className="aspect-square bg-gray-100 flex items-center justify-center text-xs text-gray-400">
                          {/* Note : storage_path est un path Firebase Storage.
                              Pour afficher l'image, il faudrait getDownloadURL.
                              On affiche un placeholder pour l'instant. */}
                          📷 {p.type ?? 'photo'}
                        </div>
                      ) : (
                        <div className="aspect-square bg-gray-100 flex items-center justify-center text-xs text-gray-400">
                          (pas d'image)
                        </div>
                      )}
                      <div className="p-2 text-xs space-y-0.5">
                        <div className="font-medium">{p.date ?? '?'}</div>
                        {p.bf_estimated !== undefined && (
                          <div className="text-gray-600">BF : {p.bf_estimated}%</div>
                        )}
                        {p.quality_score !== undefined && (
                          <div className="text-gray-500">Qualité : {p.quality_score}/10</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
