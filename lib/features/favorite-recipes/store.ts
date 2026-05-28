/**
 * Phase 12 data-layer — Favorite recipes user-specific.
 *
 * Stockage : users/{uid}/favorite_recipes/{recipeId}
 *   → { recipe_id, added_at, cooked_count, last_cooked_at, rating_1to5? }
 *
 * Pas de duplication des recettes elles-mêmes (qui sont dans
 * content/recipes/library.ts ou globally Firestore). Juste les références
 * + métadonnées d'usage perso.
 */

import 'server-only';
import { adminDb } from '@/lib/firebase/admin';

interface FavoriteRecipeDoc {
  recipe_id: string;
  added_at?: string;
  cooked_count?: number;
  last_cooked_at?: string;
  rating_1to5?: number;
}

export interface FavoriteRecipesSnapshot {
  total_count: number;
  /** Top 5 par cooked_count (favoris ancrés) */
  most_cooked: Array<{ recipe_id: string; cooked_count: number; rating_1to5?: number }>;
  /** Total cooked across all favs (proxy d'engagement nutrition) */
  total_cooked: number;
}

export async function getFavoriteRecipesSnapshot(
  uid: string,
): Promise<FavoriteRecipesSnapshot | null> {
  try {
    const snap = await adminDb
      .collection('users')
      .doc(uid)
      .collection('favorite_recipes')
      .get();
    if (snap.empty) return null;
    const docs = snap.docs.map((d) => d.data() as FavoriteRecipeDoc);

    const sorted = [...docs].sort((a, b) => (b.cooked_count ?? 0) - (a.cooked_count ?? 0));
    const totalCooked = docs.reduce((s, d) => s + (d.cooked_count ?? 0), 0);

    return {
      total_count: docs.length,
      most_cooked: sorted.slice(0, 5).map((d) => ({
        recipe_id: d.recipe_id,
        cooked_count: d.cooked_count ?? 0,
        rating_1to5: d.rating_1to5,
      })),
      total_cooked: totalCooked,
    };
  } catch (e) {
    console.warn('[favorite-recipes/store] snapshot failed:', e);
    return null;
  }
}
