'use client';

/**
 * Page /recipes/favorites — gestionnaire des recettes favorites user-specific.
 *
 * Lit users/{uid}/favorite_recipes/* (Phase 12 data-layer).
 *
 * Note : ne gère pas l'AJOUT depuis la bibliothèque ici (faudrait un picker
 * complet). Pour ajouter : modifier les pages /recipes et /recipes/[recipeId]
 * pour exposer un bouton "favori". Cette page liste juste ce qui est déjà
 * marqué + permet d'incrémenter cooked_count ou de supprimer.
 */

import { useEffect, useState } from 'react';
import { collection, query, orderBy, getDocs, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/firebase/hooks';
import Link from 'next/link';

interface FavoriteRecipeDoc {
  id: string;
  recipe_id: string;
  added_at?: string;
  cooked_count?: number;
  last_cooked_at?: string;
  rating_1to5?: number;
}

export default function FavoriteRecipesPage() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState<FavoriteRecipeDoc[]>([]);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, 'users', user.uid, 'favorite_recipes'),
          orderBy('cooked_count', 'desc'),
        );
        const snap = await getDocs(q);
        if (cancelled) return;
        setFavorites(
          snap.docs.map((d) => ({ ...(d.data() as FavoriteRecipeDoc), id: d.id })),
        );
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

  async function incrementCooked(fav: FavoriteRecipeDoc) {
    if (!user) return;
    try {
      const newCount = (fav.cooked_count ?? 0) + 1;
      await updateDoc(doc(db, 'users', user.uid, 'favorite_recipes', fav.id), {
        cooked_count: newCount,
        last_cooked_at: new Date().toISOString().slice(0, 10),
        updated_at: serverTimestamp(),
      });
      setFavorites(favorites.map((f) => (f.id === fav.id ? { ...f, cooked_count: newCount } : f)));
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : String(e));
    }
  }

  async function removeFav(fav: FavoriteRecipeDoc) {
    if (!user) return;
    if (!confirm('Retirer ce favori ?')) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'favorite_recipes', fav.id));
      setFavorites(favorites.filter((f) => f.id !== fav.id));
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : String(e));
    }
  }

  if (authLoading || loading) return <div className="p-6">Chargement…</div>;
  if (!user) return <div className="p-6">Connexion requise.</div>;

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Recettes favorites</h1>
        <p className="text-sm text-gray-500">
          Tes recettes ancrées. Pour ajouter, va sur <Link href="/recipes" className="text-blue-600 underline">/recipes</Link>.
        </p>
      </header>

      {errorText && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {errorText}
        </div>
      )}

      {favorites.length === 0 ? (
        <div className="rounded-md border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-600">
          Aucun favori. Marque tes recettes préférées depuis la bibliothèque pour les retrouver ici
          et que le coach les suggère en priorité.
        </div>
      ) : (
        <div className="space-y-2">
          {favorites.map((f) => (
            <div
              key={f.id}
              className="flex justify-between items-center rounded-md border border-gray-200 p-3"
            >
              <div>
                <Link
                  href={`/recipes/${f.recipe_id}`}
                  className="font-medium text-sm hover:underline"
                >
                  {f.recipe_id}
                </Link>
                <div className="text-xs text-gray-500">
                  Cuisiné {f.cooked_count ?? 0} fois
                  {f.last_cooked_at ? ` · dernière : ${f.last_cooked_at}` : ''}
                  {f.rating_1to5 ? ` · note ${f.rating_1to5}/5` : ''}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => incrementCooked(f)}
                  className="text-xs px-2 py-1 rounded bg-blue-600 text-white"
                >
                  +1 cuisson
                </button>
                <button
                  type="button"
                  onClick={() => removeFav(f)}
                  className="text-xs text-red-600 hover:underline"
                >
                  Retirer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
