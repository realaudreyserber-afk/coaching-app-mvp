import { Food, OFFProductSchema } from './schema';

const OFF_API_BASE = process.env.OPENFOODFACTS_API_BASE || 'https://world.openfoodfacts.org';

/**
 * Fetches product info from Open Food Facts API and normalizes it.
 */
export async function fetchFromOpenFoodFacts(barcode: string): Promise<Food | null> {
  const url = `${OFF_API_BASE}/api/v2/product/${barcode}.json`;
  
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'AntigravityCoachingApp/1.0 (support@realaudreyserber.com)',
      },
    });

    if (!res.ok) {
      console.warn(`OpenFoodFacts API error: ${res.status} ${res.statusText}`);
      return null;
    }

    const data = await res.json();
    
    if (data.status !== 1 || !data.product) {
      return null;
    }

    // Safely parse raw product using Zod schema
    const parsed = OFFProductSchema.safeParse(data.product);
    if (!parsed.success) {
      console.warn('OpenFoodFacts product schema validation failed:', parsed.error);
      return null;
    }

    const product = parsed.data;

    // Determine kcal from energy fields (sometimes energy-kcal, sometimes energy-kcal_100g)
    const kcal = product.nutriments['energy-kcal_100g'] || product.nutriments['energy-kcal'] || 0;

    // Safe parsing of nova score
    let novascore: number | undefined;
    if (product.nova_group !== undefined) {
      const score = Number(product.nova_group);
      if (!isNaN(score)) {
        novascore = score;
      }
    }

    // Normalize and clean up allergens tags (e.g. "en:gluten" -> "gluten")
    const allergens = product.allergens_tags.map((tag) => 
      tag.replace(/^[a-z]{2}:/, '').trim()
    ).filter(Boolean);

    return {
      id: barcode,
      barcode,
      name: product.product_name || 'Produit inconnu',
      brand: product.brands || 'Marque inconnue',
      kcal_100g: kcal,
      p_100g: product.nutriments.proteins_100g || 0,
      c_100g: product.nutriments.carbohydrates_100g || 0,
      f_100g: product.nutriments.fat_100g || 0,
      fiber_100g: product.nutriments.fiber_100g || 0,
      sodium_100g: product.nutriments.sodium_100g || 0,
      allergens,
      nutriscore: product.nutrition_grades?.toUpperCase(),
      novascore,
      imageUrl: product.image_url,
    };
  } catch (error) {
    console.error('Failed to fetch from OpenFoodFacts:', error);
    return null;
  }
}
