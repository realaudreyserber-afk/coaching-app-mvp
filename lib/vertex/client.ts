/* eslint-disable @typescript-eslint/no-explicit-any */
import { VertexAI } from '@google-cloud/vertexai';
import { GoogleGenAI } from '@google/genai';

const project = process.env.GOOGLE_CLOUD_PROJECT || 'mock-project-id';
const location = process.env.VERTEX_AI_LOCATION || 'europe-west1';

// Build options dynamically to support serverless environments (like Vercel)
const vertexOptions: any = {
  project: project,
  location: location,
};

// If credentials are provided in the environment (e.g. on Vercel), pass them to GoogleAuth options
if (process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
  vertexOptions.googleAuthOptions = {
    credentials: {
      client_email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
  };
}

// Initialize Vertex AI client
export const vertexAI = new VertexAI(vertexOptions);

// Instantiate the two primary models we'll use in the MVP (deprecated/legacy Vertex AI usage)
export const modelPro = vertexAI.getGenerativeModel({
  model: process.env.VERTEX_AI_MODEL_PRO || 'gemini-3.5-flash',
  generationConfig: {
    temperature: 0.2,
  },
});

export const modelFlash = vertexAI.getGenerativeModel({
  model: process.env.VERTEX_AI_MODEL_FLASH || 'gemini-3.5-flash',
  generationConfig: {
    temperature: 0.1,
  },
});

/**
 * Helper to call Vertex AI models with structured output.
 * We enforce JSON responses and validate them using Zod on the caller side.
 */
export const getGenerativeModelWithJSON = (modelName: string) => {
  return vertexAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.2,
    },
  });
};

interface GenerateOptions {
  model?: string;
  contents: any[];
  systemInstruction?: string;
  temperature?: number;
  responseMimeType?: string;
  responseSchema?: object;
  signal?: AbortSignal;
  /**
   * Audit COACH 2026-05-28 #3 : sans cap explicite, Gemini Flash applique
   * sa valeur par défaut (variable selon version, parfois ~2k tokens) ce qui
   * coupe des réponses coach longues en plein milieu. Default explicite à
   * 8192 tokens (~6000 mots français) pour éviter les troncatures visibles.
   */
  maxOutputTokens?: number;
  /**
   * Optional cached content reference (Gemini EXPLICIT caching).
   * Format : "cachedContents/{id}" returned by ai.caches.create(). Réutilise
   * le systemInstruction du cache, facturé ~10% du tarif input (caller ne doit
   * PAS passer systemInstruction en parallèle). Supporté uniquement via le SDK
   * @google/genai (requires GEMINI_API_KEY).
   *
   * ⚠️ INUTILISÉ à dessein — pour raison ÉCONOMIQUE, pas technique :
   * - Nos prompts (superviseur ~4,1k, agents ~1,2-3,5k tok) dépassent le seuil
   *   mini (~1024 tok sur 2.5/3.5 Flash) → techniquement cachables.
   * - MAIS le cache explicite facture le STOCKAGE (~1$/M tok/heure), rentable
   *   seulement à fort trafic soutenu (~4 req/h par M tok cachés, dans la TTL).
   *   Sur serverless bas trafic (cache par instance + cold starts) =
   *   break-even voire négatif.
   * - Le cache IMPLICITE (activé par défaut sur 2.5+, gratuit, SANS stockage,
   *   -90% quand un hit survient) couvre déjà ces prompts statiques, sans code.
   * Param conservé pour un éventuel gros contexte partagé à fort trafic.
   * (Le "32768 min" parfois cité = chiffre périmé ère Gemini 1.5.)
   */
  cachedContentName?: string;
}

const DEFAULT_MAX_OUTPUT_TOKENS = 8192;

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

function isRetryableError(err: unknown): boolean {
  const e = err as { status?: number; code?: number; message?: string } | undefined;
  if (!e) return false;
  if (e.status && RETRYABLE_STATUSES.has(e.status)) return true;
  if (e.code && RETRYABLE_STATUSES.has(e.code)) return true;
  if (typeof e.message === 'string' && /429|rate.?limit|overloaded|deadline/i.test(e.message)) return true;
  return false;
}

async function withRetry<T>(fn: () => Promise<T>, signal?: AbortSignal, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    if (signal?.aborted) throw new Error('Aborted');
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRetryableError(err) || i === attempts - 1) throw err;
      const delay = Math.min(2 ** i * 500 + Math.random() * 200, 4000);
      await new Promise((resolve, reject) => {
        const t = setTimeout(resolve, delay);
        if (signal) {
          signal.addEventListener('abort', () => {
            clearTimeout(t);
            reject(new Error('Aborted'));
          }, { once: true });
        }
      });
    }
  }
  throw lastErr;
}

export async function generateText(options: GenerateOptions): Promise<string> {
  const result = await generateTextWithUsage(options);
  return result.text;
}

export interface GenerateTextResult {
  text: string;
  tokens: { input: number; output: number };
}

/**
 * Variante de generateText qui retourne aussi les tokens consommés.
 * Utilisée par le système multi-agent pour cost tracking par session
 * (cf. lib/vertex/agents/). Comportement identique sinon.
 */
/**
 * Modèle utilisé côté Vertex AI. ⚠️ `gemini-3.5-flash` N'EXISTE PAS sur Vertex
 * (404 Publisher Model) — c'est un nom propre à l'API Gemini/AI Studio. Sur
 * Vertex le modèle disponible est `gemini-2.5-flash`. Override : VERTEX_AI_MODEL.
 */
const VERTEX_MODEL = process.env.VERTEX_AI_MODEL || 'gemini-2.5-flash';
const DEV_API_MODEL_DEFAULT = 'gemini-3.5-flash';

/**
 * Ordre des backends LLM. Par DÉFAUT Vertex AI en premier : il est facturé sur
 * le projet GCP (crédits d'essai gratuits), alors que la clé API Gemini/AI Studio
 * a une facturation SÉPARÉE qui peut être à sec (429 "prepayment credits depleted").
 * Repli automatique sur l'API Gemini si la clé est présente. Override explicite :
 * `LLM_BACKEND=gemini` (Gemini d'abord) ou `LLM_BACKEND=vertex` (Vertex seul).
 */
function backendOrder(): Array<'vertex' | 'gemini'> {
  const hasKey = !!process.env.GEMINI_API_KEY;
  const pref = (process.env.LLM_BACKEND || '').toLowerCase();
  if (pref === 'gemini') return hasKey ? ['gemini', 'vertex'] : ['vertex'];
  if (pref === 'vertex') return ['vertex'];
  return hasKey ? ['vertex', 'gemini'] : ['vertex'];
}

/** Erreur qui justifie de basculer sur l'autre backend (indispo/quota/permission/billing/modèle absent). */
function isFailoverError(err: unknown): boolean {
  if (isRetryableError(err)) return true;
  const e = err as { status?: number; code?: number; message?: string } | undefined;
  if (!e) return false;
  if ([403, 404].includes(e.status ?? -1) || [403, 404].includes(e.code ?? -1)) return true;
  return (
    typeof e.message === 'string' &&
    /permission|quota|exhaust|credit|billing|forbidden|not found|RESOURCE_EXHAUSTED/i.test(e.message)
  );
}

async function callGeminiApiOnce(options: GenerateOptions): Promise<GenerateTextResult> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await withRetry(() => ai.models.generateContent({
    model: options.model || DEV_API_MODEL_DEFAULT,
    contents: options.contents,
    config: {
      temperature: options.temperature ?? 0.3,
      responseMimeType: options.responseMimeType,
      responseSchema: options.responseSchema,
      maxOutputTokens: options.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
      ...(options.cachedContentName
        ? { cachedContent: options.cachedContentName }
        : { systemInstruction: options.systemInstruction }),
      abortSignal: options.signal,
    } as any,
  }), options.signal);
  const usage = (response as any).usageMetadata ?? {};
  return {
    text: response.text || '',
    tokens: { input: usage.promptTokenCount ?? 0, output: usage.candidatesTokenCount ?? 0 },
  };
}

async function callVertexOnce(options: GenerateOptions): Promise<GenerateTextResult> {
  const model = vertexAI.getGenerativeModel({
    model: VERTEX_MODEL,
    generationConfig: {
      temperature: options.temperature ?? 0.3,
      responseMimeType: options.responseMimeType,
      maxOutputTokens: options.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
      ...(options.responseSchema ? { responseSchema: options.responseSchema as any } : {}),
    },
    systemInstruction: options.systemInstruction
      ? { role: 'system', parts: [{ text: options.systemInstruction }] }
      : undefined,
  });
  const response = await withRetry(() => model.generateContent({ contents: options.contents }), options.signal);
  const responseResult = response.response;
  const usage = (responseResult as any).usageMetadata ?? {};
  return {
    text: responseResult.candidates?.[0]?.content?.parts?.[0]?.text || '',
    tokens: { input: usage.promptTokenCount ?? 0, output: usage.candidatesTokenCount ?? 0 },
  };
}

export async function generateTextWithUsage(options: GenerateOptions): Promise<GenerateTextResult> {
  const order = backendOrder();
  let lastErr: unknown;
  for (let i = 0; i < order.length; i++) {
    const backend = order[i];
    try {
      return backend === 'vertex' ? await callVertexOnce(options) : await callGeminiApiOnce(options);
    } catch (err) {
      lastErr = err;
      const hasNext = i < order.length - 1;
      if (!hasNext || !isFailoverError(err)) throw err;
      console.warn(
        `[vertex/client] backend "${backend}" KO (${String((err as Error)?.message).slice(0, 120)}) → repli sur "${order[i + 1]}"`,
      );
    }
  }
  throw lastErr;
}

export function parseLLMJson<T = unknown>(raw: string): T {
  if (!raw || typeof raw !== 'string') {
    throw new Error('Empty LLM response');
  }
  let cleaned = raw.trim();
  const fenceMatch = cleaned.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenceMatch) cleaned = fenceMatch[1].trim();
  if (cleaned.startsWith('json\n')) cleaned = cleaned.slice(5);
  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    const first = cleaned.indexOf('{');
    const last = cleaned.lastIndexOf('}');
    if (first !== -1 && last > first) {
      try {
        return JSON.parse(cleaned.slice(first, last + 1)) as T;
      } catch {
        // fall through
      }
    }
    throw new Error(`LLM JSON parse failed: ${(err as Error).message}`);
  }
}

async function* streamGeminiApi(options: GenerateOptions): AsyncGenerator<string, void, unknown> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const stream = await ai.models.generateContentStream({
    model: options.model || DEV_API_MODEL_DEFAULT,
    contents: options.contents,
    config: {
      temperature: options.temperature ?? 0.3,
      responseMimeType: options.responseMimeType,
      maxOutputTokens: options.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
      ...(options.cachedContentName
        ? { cachedContent: options.cachedContentName }
        : { systemInstruction: options.systemInstruction }),
      abortSignal: options.signal,
    } as any,
  });
  for await (const chunk of stream) {
    if (options.signal?.aborted) return;
    const text = chunk.text;
    if (text) yield text;
  }
}

async function* streamVertex(options: GenerateOptions): AsyncGenerator<string, void, unknown> {
  const model = vertexAI.getGenerativeModel({
    model: VERTEX_MODEL,
    generationConfig: {
      temperature: options.temperature ?? 0.3,
      responseMimeType: options.responseMimeType,
      maxOutputTokens: options.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
    },
    systemInstruction: options.systemInstruction
      ? { role: 'system', parts: [{ text: options.systemInstruction }] }
      : undefined,
  });
  const streamingResult = await model.generateContentStream({ contents: options.contents });
  for await (const item of streamingResult.stream) {
    if (options.signal?.aborted) return;
    const text = item.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) yield text;
  }
}

export async function* generateTextStream(options: GenerateOptions): AsyncGenerator<string, void, unknown> {
  const order = backendOrder();
  for (let i = 0; i < order.length; i++) {
    const backend = order[i];
    const gen = backend === 'vertex' ? streamVertex(options) : streamGeminiApi(options);
    let yielded = false;
    try {
      for await (const text of gen) {
        yielded = true;
        yield text;
      }
      return;
    } catch (err) {
      const hasNext = i < order.length - 1;
      // Repli seulement si rien n'a encore été streamé (sinon on ne peut pas annuler).
      if (yielded || !hasNext || !isFailoverError(err)) throw err;
      console.warn(
        `[vertex/client] stream "${backend}" KO avant 1er chunk → repli sur "${order[i + 1]}"`,
      );
    }
  }
}
