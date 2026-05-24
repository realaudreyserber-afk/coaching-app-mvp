import { generateText } from './client';
import { SAFETY_SYSTEM_PROMPT } from './prompts/safety-layer';
import { SafetySchema, SafetyOutput } from './schemas';
import { SAFETY_RESPONSE_SCHEMA } from './response-schemas';
import {
  SUICIDE_KEYWORDS_FR,
  TCA_KEYWORDS_FR,
  normalizeForSafety,
  normalizeKeywords,
} from './safety-dict.fr';

const SUICIDE_NORM = normalizeKeywords(SUICIDE_KEYWORDS_FR);
const TCA_NORM = normalizeKeywords(TCA_KEYWORDS_FR);

export interface SafetyContext {
  weightKg?: number;
  heightCm?: number;
}

function computeBmi(ctx: SafetyContext): number | null {
  if (!ctx.weightKg || !ctx.heightCm) return null;
  const h = ctx.heightCm / 100;
  if (h <= 0) return null;
  return ctx.weightKg / (h * h);
}

function fastPathCheck(text: string, ctx: SafetyContext): SafetyOutput | null {
  const lower = normalizeForSafety(text);

  if (SUICIDE_NORM.some(k => lower.includes(k))) {
    return {
      flagged: true,
      reason: 'SUICIDE',
      message:
        "Si tu traverses une période très difficile et penses au suicide, sache que tu n'es pas seul. S'il te plaît, contacte immédiatement le 3114 (numéro national de prévention du suicide, gratuit et confidentiel en France) ou les secours au 15 ou 112. Je dois interrompre notre échange pour ta sécurité.",
    };
  }

  if (TCA_NORM.some(k => lower.includes(k))) {
    return {
      flagged: true,
      reason: 'TCA',
      message:
        "Je remarque des signes de restriction ou de comportement alimentaire qui m'inquiètent pour ta santé. Mon rôle de coach IA s'arrête ici pour te protéger. Je t'invite vivement à te tourner vers des professionnels spécialisés ou à consulter la FFAB : https://ffab.fr/",
    };
  }

  const bmi = computeBmi(ctx);
  if (bmi !== null && bmi < 18.5) {
    return {
      flagged: true,
      reason: 'UNDERWEIGHT',
      message: `Ton IMC est de ${bmi.toFixed(1)} (< 18.5), ce qui correspond à une situation de sous-poids. Pour préserver ta santé, je ne peux pas générer de plan orienté perte de poids. Je t'encourage vivement à consulter un médecin ou un nutritionniste.`,
    };
  }

  return null;
}

export async function runSafetyCheck(text: string, ctx: SafetyContext = {}): Promise<SafetyOutput> {
  const fast = fastPathCheck(text, ctx);
  if (fast) return fast;

  if (process.env.SAFETY_DEEP_CHECK !== '1') {
    return { flagged: false, reason: null, message: null };
  }

  try {
    const raw = await generateText({
      model: process.env.VERTEX_AI_MODEL_FLASH || 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text }] }],
      systemInstruction: SAFETY_SYSTEM_PROMPT,
      temperature: 0,
      responseMimeType: 'application/json',
      responseSchema: SAFETY_RESPONSE_SCHEMA,
    });

    const parsed = SafetySchema.safeParse(JSON.parse(raw || '{}'));
    if (parsed.success) return parsed.data;
    return { flagged: false, reason: null, message: null };
  } catch (err) {
    console.error('Safety deep check failed, defaulting to safe:', err);
    return { flagged: false, reason: null, message: null };
  }
}

export async function checkUserBaseline(ctx: SafetyContext): Promise<SafetyOutput> {
  const fast = fastPathCheck('', ctx);
  return fast ?? { flagged: false, reason: null, message: null };
}
