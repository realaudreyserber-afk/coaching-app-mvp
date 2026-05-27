/**
 * Helper Gemini explicit context caching pour le COACH_SYSTEM_PROMPT.
 *
 * Le prompt système coach fait ~25k tokens et est identique pour tous les
 * users — candidat parfait pour le cache explicit. Cached input tokens
 * sont facturés ~10% du tarif normal (Gemini 3.5 Flash). Sur des sessions
 * coach actives (5-20 messages), l'économie est significative.
 *
 * Architecture :
 *   - 1 cache global partagé (le COACH_SYSTEM_PROMPT ne varie pas)
 *   - Stocké en mémoire serverless (cold start = nouveau cache)
 *   - TTL Gemini = 1h, on refresh à 50min pour être safe
 *   - Fallback no-cache si la création échoue (le coach continue à fonctionner
 *     en mode normal, juste sans économie)
 *
 * Pour activer :
 *   1. Importer dans /api/ai/coach/route.ts :
 *        import { getCoachSystemPromptCache } from '@/lib/vertex/cached-coach-prompt';
 *   2. Récupérer le cache name AVANT l'appel generateTextStream :
 *        const cacheName = await getCoachSystemPromptCache();
 *   3. Si cacheName est non-null, modifier l'appel :
 *        - Passer cachedContentName: cacheName
 *        - NE PAS passer systemInstruction (il est déjà dans le cache)
 *        - Le profileBlock + blocks enrichis doivent être prepended dans le
 *          1er message user (cf. patron suggéré dans le commit message).
 *
 * Limites actuelles :
 *   - Marche uniquement avec @google/genai (requires GEMINI_API_KEY env var).
 *     Avec le SDK Vertex AI direct, l'API caching diffère — non implémenté ici.
 *   - Pas de mécanisme cross-serverless (chaque instance Vercel a son cache local).
 *     Acceptable parce que le cache est cheap à créer (~1 call API au premier
 *     message d'une instance, puis réutilisé 1h).
 */

import 'server-only';
import { GoogleGenAI } from '@google/genai';
import { COACH_SYSTEM_PROMPT } from './prompts/coach';

interface CacheState {
  name: string;
  createdAt: number;
  model: string;
}

let coachCache: CacheState | null = null;
const TTL_MS = 50 * 60 * 1000; // 50 min — refresh avant l'expiration Gemini 1h

let aiClient: GoogleGenAI | null = null;

function getAi(): GoogleGenAI | null {
  if (aiClient) return aiClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  aiClient = new GoogleGenAI({ apiKey });
  return aiClient;
}

/**
 * Retourne le nom du cache Gemini pour le COACH_SYSTEM_PROMPT, ou null si :
 *   - GEMINI_API_KEY n'est pas configuré
 *   - La création du cache a échoué
 *   - Le modèle ne supporte pas le caching
 *
 * Le caller doit gérer le cas null en fallback no-cache.
 */
export async function getCoachSystemPromptCache(): Promise<string | null> {
  const ai = getAi();
  if (!ai) {
    // Pas de GEMINI_API_KEY → on est sur le SDK Vertex AI direct,
    // qui n'est pas couvert par cet helper.
    return null;
  }

  const model = process.env.VERTEX_AI_MODEL_PRO || 'gemini-3.5-flash';
  const now = Date.now();

  // Cache encore valide ?
  if (coachCache && coachCache.model === model && (now - coachCache.createdAt) < TTL_MS) {
    return coachCache.name;
  }

  // Créer (ou re-créer) le cache
  try {
    const cache = await ai.caches.create({
      model,
      config: {
        systemInstruction: COACH_SYSTEM_PROMPT,
        ttl: '3600s', // 1 heure
      },
    });
    coachCache = { name: cache.name ?? '', createdAt: now, model };
    return coachCache.name || null;
  } catch (err) {
    // Quota dépassé, modèle non supporté, ou autre — on tombe en no-cache.
    console.warn('[cached-coach-prompt] failed to create cache, falling back:', err);
    return null;
  }
}

/**
 * Force la suppression du cache courant. Utile si :
 *   - Le COACH_SYSTEM_PROMPT a été modifié et déployé (hot reload du cache)
 *   - Tests d'intégration veulent un état propre
 */
export async function invalidateCoachSystemPromptCache(): Promise<void> {
  if (!coachCache) return;
  const ai = getAi();
  if (!ai) {
    coachCache = null;
    return;
  }
  try {
    await ai.caches.delete({ name: coachCache.name });
  } catch (err) {
    console.warn('[cached-coach-prompt] failed to delete cache:', err);
  } finally {
    coachCache = null;
  }
}
