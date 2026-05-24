/**
 * M6 — Open Food Facts base ingestion (daily cron).
 *
 * Pulls the OFF "delta" dump for FR/DE/IT/ES locales and upserts
 * normalized entries into content/foods/items/{barcode}.
 *
 * Schema written:
 *   {
 *     barcode, name, brand?, kcal_100g, p_100g, c_100g, f_100g,
 *     fiber_100g?, sodium_100g?, allergens?: string[],
 *     nutriscore?: 'a'|'b'|'c'|'d'|'e', novascore?: number,
 *     locale, updated_at
 *   }
 *
 * Note: OFF full dump is ~5 GB. We use the "recently modified products" JSON
 * stream (last 24h) to keep this cron under 540s timeout.
 */
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { processInChunks } from './lib/parallel';

interface OFFProduct {
  code?: string;
  product_name?: string;
  product_name_fr?: string;
  brands?: string;
  nutriments?: {
    'energy-kcal_100g'?: number;
    proteins_100g?: number;
    carbohydrates_100g?: number;
    fat_100g?: number;
    fiber_100g?: number;
    sodium_100g?: number;
  };
  allergens_tags?: string[];
  nutriscore_grade?: string;
  nova_group?: number;
  lang?: string;
}

interface NormalizedFood {
  barcode: string;
  name: string;
  brand?: string;
  kcal_100g: number;
  p_100g: number;
  c_100g: number;
  f_100g: number;
  fiber_100g?: number;
  sodium_100g?: number;
  allergens?: string[];
  nutriscore?: string;
  novascore?: number;
  locale?: string;
  updated_at: string;
}

const TARGET_LOCALES = ['fr', 'de', 'it', 'es'];
const MAX_PRODUCTS_PER_RUN = 5000;

function normalize(p: OFFProduct): NormalizedFood | null {
  const barcode = p.code?.trim();
  const name = (p.product_name_fr || p.product_name || '').trim();
  const n = p.nutriments;
  if (
    !barcode ||
    !name ||
    !n ||
    typeof n['energy-kcal_100g'] !== 'number' ||
    typeof n.proteins_100g !== 'number' ||
    typeof n.carbohydrates_100g !== 'number' ||
    typeof n.fat_100g !== 'number'
  ) {
    return null;
  }
  return {
    barcode,
    name,
    brand: p.brands?.split(',')[0]?.trim() || undefined,
    kcal_100g: n['energy-kcal_100g'],
    p_100g: n.proteins_100g,
    c_100g: n.carbohydrates_100g,
    f_100g: n.fat_100g,
    fiber_100g: n.fiber_100g,
    sodium_100g: n.sodium_100g,
    allergens: p.allergens_tags?.length ? p.allergens_tags.slice(0, 20) : undefined,
    nutriscore: p.nutriscore_grade,
    novascore: p.nova_group,
    locale: p.lang,
    updated_at: new Date().toISOString(),
  };
}

async function fetchOFFDelta(locale: string, sinceIso: string): Promise<OFFProduct[]> {
  // OFF Search API filtered by locale + last modified
  const url = new URL('https://world.openfoodfacts.org/api/v2/search');
  url.searchParams.set('countries_tags_en', locale);
  url.searchParams.set('last_modified_t', sinceIso);
  url.searchParams.set('page_size', '500');
  url.searchParams.set('fields', 'code,product_name,product_name_fr,brands,nutriments,allergens_tags,nutriscore_grade,nova_group,lang');

  try {
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'LinsociableCoach/1.0 (contact: dev@linsociable.fr)' },
    });
    if (!res.ok) {
      logger.warn(`OFF fetch failed for locale ${locale}: ${res.status}`);
      return [];
    }
    const data = (await res.json()) as { products?: OFFProduct[] };
    return Array.isArray(data.products) ? data.products : [];
  } catch (err) {
    logger.error(`OFF fetch error locale ${locale}:`, err);
    return [];
  }
}

export const offBaseIngestion = onSchedule(
  {
    schedule: 'every day 02:30',
    timeZone: 'Europe/Paris',
    region: 'europe-west1',
    memory: '1GiB',
    timeoutSeconds: 540,
  },
  async () => {
    const db = getFirestore();
    const sinceIso = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    let totalUpserted = 0;
    let totalSkipped = 0;

    for (const locale of TARGET_LOCALES) {
      const products = await fetchOFFDelta(locale, sinceIso);
      const normalized = products
        .map(normalize)
        .filter((f): f is NormalizedFood => f !== null)
        .slice(0, Math.max(0, MAX_PRODUCTS_PER_RUN - totalUpserted));

      if (normalized.length === 0) continue;

      const results = await processInChunks(normalized, 50, async (food) => {
        try {
          await db
            .collection('content').doc('foods')
            .collection('items').doc(food.barcode)
            .set(food, { merge: true });
          return true;
        } catch (err) {
          logger.error(`Upsert failed for ${food.barcode}:`, err);
          return false;
        }
      });

      const upserted = results.filter(Boolean).length;
      totalUpserted += upserted;
      totalSkipped += products.length - normalized.length;
      logger.info(`OFF locale ${locale}: ${upserted} upserted, ${products.length - normalized.length} skipped`);

      if (totalUpserted >= MAX_PRODUCTS_PER_RUN) break;
    }

    logger.info(`OFF daily ingestion done: ${totalUpserted} upserted, ${totalSkipped} skipped (incomplete data)`);
  }
);
