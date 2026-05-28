'use client';

/**
 * Page /shopping — liste de courses simple.
 *
 * 1 liste active à la fois (peut renommer). Items add/check/delete.
 * Bouton "archiver" pour passer à une nouvelle liste vierge.
 *
 * Pas d'auto-gen depuis plan.meals_template ici (cf Phase 13 du roadmap,
 * nécessite ingrédients structurés dans les meals — pas garanti).
 */

import { useEffect, useState } from 'react';
import {
  collection,
  query,
  getDocs,
  doc,
  addDoc,
  updateDoc,
  serverTimestamp,
  where,
  limit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/firebase/hooks';
import { useConfirm } from '@/components/ui/confirm-dialog';

interface ShoppingItem {
  name: string;
  quantity?: string;
  checked: boolean;
}

interface ShoppingListDoc {
  id: string;
  name: string;
  status: 'active' | 'archived';
  items?: ShoppingItem[];
  week_start?: string;
  created_at?: string;
}

export default function ShoppingPage() {
  const { user, loading: authLoading } = useAuth();
  const confirm = useConfirm();
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [activeList, setActiveList] = useState<ShoppingListDoc | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState('');

  async function loadActive() {
    if (!user) return;
    // Audit 2026-05-28 #14 : l'ancien `orderBy('created_at')` exigeait un index
    // composite (status + created_at) absent → crash failed-precondition en prod,
    // et triait sur un serverTimestamp null localement → liste invisible + boucle
    // de re-création. Une seule liste active est attendue : where + limit(1) suffit
    // (pas d'index composite requis pour une simple égalité).
    const q = query(
      collection(db, 'users', user.uid, 'shopping_lists'),
      where('status', '==', 'active'),
      limit(1),
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      // Create new active list
      const newRef = await addDoc(collection(db, 'users', user.uid, 'shopping_lists'), {
        name: 'Courses de la semaine',
        status: 'active',
        items: [],
        created_at: serverTimestamp(),
      });
      setActiveList({ id: newRef.id, name: 'Courses de la semaine', status: 'active', items: [] });
    } else {
      const d = snap.docs[0];
      setActiveList({ ...(d.data() as ShoppingListDoc), id: d.id });
    }
  }

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        if (!cancelled) await loadActive();
      } catch (e) {
        if (!cancelled) setErrorText(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function addItem() {
    if (!user || !activeList || !newItemName.trim()) return;
    const newItem: ShoppingItem = {
      name: newItemName.trim().slice(0, 80),
      quantity: newItemQty.trim().slice(0, 30) || undefined,
      checked: false,
    };
    const newItems = [...(activeList.items ?? []), newItem];
    try {
      await updateDoc(doc(db, 'users', user.uid, 'shopping_lists', activeList.id), {
        items: newItems,
        updated_at: serverTimestamp(),
      });
      setActiveList({ ...activeList, items: newItems });
      setNewItemName('');
      setNewItemQty('');
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : String(e));
    }
  }

  async function toggleItem(idx: number) {
    if (!user || !activeList) return;
    const newItems = [...(activeList.items ?? [])];
    newItems[idx] = { ...newItems[idx], checked: !newItems[idx].checked };
    try {
      await updateDoc(doc(db, 'users', user.uid, 'shopping_lists', activeList.id), {
        items: newItems,
        updated_at: serverTimestamp(),
      });
      setActiveList({ ...activeList, items: newItems });
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : String(e));
    }
  }

  async function removeItem(idx: number) {
    if (!user || !activeList) return;
    const newItems = (activeList.items ?? []).filter((_, i) => i !== idx);
    try {
      await updateDoc(doc(db, 'users', user.uid, 'shopping_lists', activeList.id), {
        items: newItems,
        updated_at: serverTimestamp(),
      });
      setActiveList({ ...activeList, items: newItems });
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : String(e));
    }
  }

  async function archiveAndCreateNew() {
    if (!user || !activeList) return;
    if (!(await confirm({
      title: 'Archiver la liste',
      message: 'Archiver cette liste de courses et en démarrer une nouvelle ?',
      confirmLabel: 'Archiver',
    }))) return;
    try {
      await updateDoc(doc(db, 'users', user.uid, 'shopping_lists', activeList.id), {
        status: 'archived',
        archived_at: serverTimestamp(),
      });
      await loadActive();
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : String(e));
    }
  }

  if (authLoading || loading) return <div className="p-6">Chargement…</div>;
  if (!user) return <div className="p-6">Connexion requise.</div>;

  const items = activeList?.items ?? [];
  const checkedCount = items.filter((i) => i.checked).length;

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Liste de courses</h1>
        <p className="text-sm text-gray-500">{activeList?.name}</p>
      </header>

      {errorText && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {errorText}
        </div>
      )}

      {/* Add */}
      <section className="rounded-md border border-gray-200 p-4 space-y-2">
        <h2 className="text-sm font-semibold">Ajouter un article</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder="Ex: poulet, riz, brocoli…"
            maxLength={80}
            className="flex-1 rounded-md border border-gray-300 p-2 text-sm"
          />
          <input
            type="text"
            value={newItemQty}
            onChange={(e) => setNewItemQty(e.target.value)}
            placeholder="Qté (ex: 1kg)"
            maxLength={30}
            className="w-24 rounded-md border border-gray-300 p-2 text-sm"
          />
          <button
            onClick={addItem}
            disabled={!newItemName.trim()}
            className="px-3 py-2 text-sm rounded-md bg-blue-600 text-white disabled:opacity-50"
          >
            +
          </button>
        </div>
      </section>

      {/* List */}
      {items.length > 0 ? (
        <section className="rounded-md border border-gray-200 p-4 space-y-1">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-sm font-semibold">{items.length} articles ({checkedCount} cochés)</h2>
            <button
              type="button"
              onClick={archiveAndCreateNew}
              className="text-xs text-gray-600 hover:underline"
            >
              Archiver + nouvelle liste
            </button>
          </div>
          {items.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 py-1.5 border-b last:border-b-0"
            >
              <button
                type="button"
                onClick={() => toggleItem(idx)}
                className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                  item.checked ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300'
                }`}
              >
                {item.checked && '✓'}
              </button>
              <div className={`flex-1 text-sm ${item.checked ? 'line-through text-gray-400' : ''}`}>
                {item.name}
                {item.quantity && <span className="text-xs text-gray-500 ml-2">{item.quantity}</span>}
              </div>
              <button
                type="button"
                onClick={() => removeItem(idx)}
                className="text-xs text-red-600 hover:underline"
              >
                ×
              </button>
            </div>
          ))}
        </section>
      ) : (
        <div className="rounded-md border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-600">
          Liste vide. Ajoute des articles ci-dessus.
        </div>
      )}
    </div>
  );
}
