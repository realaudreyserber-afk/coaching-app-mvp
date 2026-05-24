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
  model: process.env.VERTEX_AI_MODEL_PRO || 'gemini-2.5-pro',
  generationConfig: {
    temperature: 0.2,
  },
});

export const modelFlash = vertexAI.getGenerativeModel({
  model: process.env.VERTEX_AI_MODEL_FLASH || 'gemini-2.5-flash',
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
}

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
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const modelName = options.model || process.env.VERTEX_AI_MODEL_PRO || 'gemini-2.5-pro';

  if (geminiApiKey) {
    const ai = new GoogleGenAI({ apiKey: geminiApiKey });
    const response = await withRetry(() => ai.models.generateContent({
      model: modelName,
      contents: options.contents,
      config: {
        temperature: options.temperature ?? 0.3,
        responseMimeType: options.responseMimeType,
        responseSchema: options.responseSchema,
        systemInstruction: options.systemInstruction,
        abortSignal: options.signal,
      } as any,
    }), options.signal);

    return response.text || '';
  }

  const model = vertexAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: options.temperature ?? 0.3,
      responseMimeType: options.responseMimeType,
      ...(options.responseSchema ? { responseSchema: options.responseSchema as any } : {}),
    },
    systemInstruction: options.systemInstruction
      ? { role: 'system', parts: [{ text: options.systemInstruction }] }
      : undefined,
  });

  const response = await withRetry(
    () => model.generateContent({ contents: options.contents }),
    options.signal
  );

  const responseResult = response.response;
  return responseResult.candidates?.[0]?.content?.parts?.[0]?.text || '';
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

export async function* generateTextStream(options: GenerateOptions): AsyncGenerator<string, void, unknown> {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const modelName = options.model || process.env.VERTEX_AI_MODEL_PRO || 'gemini-2.5-pro';

  if (geminiApiKey) {
    const ai = new GoogleGenAI({ apiKey: geminiApiKey });
    const stream = await ai.models.generateContentStream({
      model: modelName,
      contents: options.contents,
      config: {
        temperature: options.temperature ?? 0.3,
        responseMimeType: options.responseMimeType,
        systemInstruction: options.systemInstruction,
        abortSignal: options.signal,
      } as any,
    });

    for await (const chunk of stream) {
      if (options.signal?.aborted) return;
      const text = chunk.text;
      if (text) yield text;
    }
    return;
  }

  const model = vertexAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: options.temperature ?? 0.3,
      responseMimeType: options.responseMimeType,
    },
    systemInstruction: options.systemInstruction
      ? { role: 'system', parts: [{ text: options.systemInstruction }] }
      : undefined,
  });

  const streamingResult = await model.generateContentStream({
    contents: options.contents,
  });

  for await (const item of streamingResult.stream) {
    if (options.signal?.aborted) return;
    const text = item.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) yield text;
  }
}
