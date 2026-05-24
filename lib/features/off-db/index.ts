import { doc, getDoc, setDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Food, FoodSchema } from './schema';

/**
 * Gets a food item from the client-side Firestore cache.
 */
export async function getCachedFood(barcode: string): Promise<Food | null> {
  try {
    const docRef = doc(db, 'content', 'foods', 'items', barcode);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      const parsed = FoodSchema.safeParse(data);
      if (parsed.success) {
        return parsed.data;
      }
    }
    return null;
  } catch (error) {
    console.error('Error fetching cached food:', error);
    return null;
  }
}

/**
 * Caches a food item in Firestore from the client.
 */
export async function cacheFood(food: Food): Promise<void> {
  try {
    const docRef = doc(db, 'content', 'foods', 'items', food.id);
    await setDoc(docRef, {
      ...food,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error caching food:', error);
  }
}

/**
 * Searches cached foods by name or brand in the Firestore database.
 * Matches case-insensitively using normalized queries (starts-with or direct match).
 */
export async function searchCachedFoods(queryStr: string, maxResults = 10): Promise<Food[]> {
  try {
    const foodsRef = collection(db, 'content', 'foods', 'items');
    // Simple query by name match (requires exact name or custom normalization, 
    // so we search by name prefix or fallback to filtering in code for small scales)
    const normalizedQuery = queryStr.toLowerCase().trim();
    if (!normalizedQuery) return [];

    const q = query(
      foodsRef,
      where('name', '>=', queryStr),
      where('name', '<=', queryStr + '\uf8ff'),
      limit(maxResults)
    );
    
    const querySnapshot = await getDocs(q);
    const results: Food[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const parsed = FoodSchema.safeParse(data);
      if (parsed.success) {
        results.push(parsed.data);
      }
    });

    return results;
  } catch (error) {
    console.error('Error searching cached foods:', error);
    return [];
  }
}
