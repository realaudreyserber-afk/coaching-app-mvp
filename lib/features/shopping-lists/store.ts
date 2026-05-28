/**
 * Phase 13 data-layer — Shopping lists user-specific.
 *
 * Stockage : users/{uid}/shopping_lists/{listId}
 * Auto-id ou date-based si "current_week" pattern.
 *
 * Liée optionnellement à plan.meals_template (auto-gen depuis le plan).
 */

import 'server-only';
import { adminDb } from '@/lib/firebase/admin';

interface ShoppingListDoc {
  name: string;
  status: 'active' | 'archived';
  items?: Array<{ name: string; quantity?: string; checked: boolean; recipe_ref?: string }>;
  week_start?: string;
  created_at?: string;
}

export interface ShoppingListsSnapshot {
  /** Liste active (la plus récente unarchived) */
  active_list_name: string | null;
  active_list_items_count: number;
  active_list_checked_count: number;
  /** Nombre total de listes archivées */
  archived_count: number;
}

export async function getShoppingListsSnapshot(
  uid: string,
): Promise<ShoppingListsSnapshot | null> {
  try {
    const snap = await adminDb
      .collection('users')
      .doc(uid)
      .collection('shopping_lists')
      .get();
    if (snap.empty) return null;
    const docs = snap.docs.map((d) => d.data() as ShoppingListDoc);
    const active = docs.find((d) => d.status === 'active');
    const archived = docs.filter((d) => d.status === 'archived');
    return {
      active_list_name: active?.name ?? null,
      active_list_items_count: active?.items?.length ?? 0,
      active_list_checked_count: active?.items?.filter((i) => i.checked).length ?? 0,
      archived_count: archived.length,
    };
  } catch (e) {
    console.warn('[shopping-lists/store] snapshot failed:', e);
    return null;
  }
}
