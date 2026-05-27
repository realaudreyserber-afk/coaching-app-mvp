/**
 * BaseAgent — classe abstraite que chaque sous-agent étend.
 *
 * Contrat :
 *   - `name` et `systemPrompt` sont définis par la sous-classe (statique au boot)
 *   - `fetchContext()` est implémenté par chaque agent pour aller chercher
 *     SES données spécifiques dans Firestore (scope étroit, pas le full enrichment)
 *   - `run()` orchestre : fetchContext → build prompt → Gemini → parse → return
 *   - En cas d'erreur : on log via le tracer + on retourne un AgentOutput minimal
 *     avec error set, plutôt que de throw — pour ne pas casser le Supervisor.
 *
 * Le Supervisor instancie l'agent puis appelle `run(input, sharedMemory)`.
 * L'agent ne doit JAMAIS muter directement `sharedMemory` ; il retourne
 * un AgentOutput structuré, et le Supervisor centralise les writes.
 */

import 'server-only';
import { generateTextWithUsage, parseLLMJson } from '../../client';
import { tracer } from '../tracing';
import { isValidSubAgentName } from '../types';
import type {
  AgentConfidence,
  AgentInput,
  AgentOutput,
  AgentSeverity,
  SharedSessionMemory,
  SubAgentName,
} from '../types';

const VALID_SEVERITIES: AgentSeverity[] = ['info', 'warning', 'critical'];
const VALID_CONFIDENCES: AgentConfidence[] = ['low', 'medium', 'high'];

export abstract class BaseAgent {
  abstract readonly name: SubAgentName;
  abstract readonly systemPrompt: string;
  readonly model: string = 'gemini-3.5-flash';
  readonly temperature: number = 0.3;

  /**
   * Fetch les données Firestore spécifiques à cet agent.
   * Scope étroit — pas tout le user data, juste ce dont CET agent a besoin.
   */
  protected abstract fetchContext(input: AgentInput): Promise<Record<string, unknown>>;

  /**
   * Construit le prompt user complet (data context + user message + reason + format).
   * Surchargeable si un agent a besoin d'un format particulier.
   */
  protected buildUserPrompt(
    input: AgentInput,
    context: Record<string, unknown>,
  ): string {
    const memNotes = input.shared_memory?.notes ?? {};
    const memFacts = input.shared_memory?.facts ?? {};
    return (
      `[CONTEXTE DOMAINE]\n${JSON.stringify(context, null, 2)}\n\n` +
      `[NOTES DES AUTRES AGENTS]\n${JSON.stringify(memNotes, null, 2)}\n\n` +
      `[FAITS PARTAGÉS]\n${JSON.stringify(memFacts, null, 2)}\n\n` +
      `[MESSAGE USER]\n${input.user_message}\n\n` +
      `[POURQUOI TU ES CONSULTÉ]\n${input.reason_for_consult}\n\n` +
      `[FORMAT DE RÉPONSE OBLIGATOIRE]\n` +
      `Retourne un JSON respectant strictement :\n` +
      `{\n` +
      `  "diagnostic": string,\n` +
      `  "recommendations": string[],\n` +
      `  "severity": "info" | "warning" | "critical",\n` +
      `  "confidence": "low" | "medium" | "high",\n` +
      `  "citations": [{"label": string, "url"?: string}] (optionnel),\n` +
      `  "request_consult": SubAgentName[] (optionnel),\n` +
      `  "raw_data": object (optionnel — données brutes pour audit)\n` +
      `}\n` +
      `Pas de texte hors JSON, pas de fences markdown.`
    );
  }

  /**
   * Pipeline principal de l'agent. Appelé par le Supervisor.
   * Le 2e param sharedMemory est passé en lecture seule ici (l'agent ne mute pas).
   */
  async run(input: AgentInput, _sharedMemory: SharedSessionMemory): Promise<AgentOutput> {
    const trace = tracer.forSession(input.session_id, input.uid);
    const startMs = Date.now();

    try {
      trace.agent(this.name, 'start', 'info', {
        reason: input.reason_for_consult,
      });

      const context = await this.fetchContext(input);
      const userPrompt = this.buildUserPrompt(input, context);

      const result = await generateTextWithUsage({
        model: this.model,
        systemInstruction: this.systemPrompt,
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        temperature: this.temperature,
        responseMimeType: 'application/json',
      });

      const parsed = this.parseOutput(result.text);
      const duration = Date.now() - startMs;

      trace.agent(this.name, 'finish', 'info', {
        duration_ms: duration,
        tokens: result.tokens,
      });

      return {
        ...parsed,
        agent: this.name,
        duration_ms: duration,
        tokens: result.tokens,
      };
    } catch (err) {
      await trace.captureError(err, this.name);
      return {
        agent: this.name,
        diagnostic: '(erreur agent — résultat ignoré)',
        recommendations: [],
        severity: 'info',
        confidence: 'low',
        error: err instanceof Error ? err.message : String(err),
        duration_ms: Date.now() - startMs,
      };
    }
  }

  /**
   * Parse la réponse Gemini en AgentOutput partiel. Tolérant aux fences
   * markdown via parseLLMJson, et défensif sur les enums (default vers
   * valeur safe si l'LLM hallucine).
   */
  private parseOutput(raw: string): Omit<AgentOutput, 'agent' | 'duration_ms' | 'tokens'> {
    const obj = parseLLMJson<Record<string, unknown>>(raw);

    const severity = VALID_SEVERITIES.includes(obj.severity as AgentSeverity)
      ? (obj.severity as AgentSeverity)
      : 'info';

    const confidence = VALID_CONFIDENCES.includes(obj.confidence as AgentConfidence)
      ? (obj.confidence as AgentConfidence)
      : 'medium';

    const citations = Array.isArray(obj.citations)
      ? (obj.citations as Array<{ label: string; url?: string }>).filter(
          (c) => c && typeof c.label === 'string',
        )
      : undefined;

    const requestConsult = Array.isArray(obj.request_consult)
      ? (obj.request_consult as unknown[]).filter(isValidSubAgentName)
      : undefined;

    return {
      diagnostic: typeof obj.diagnostic === 'string' ? obj.diagnostic : '',
      recommendations: Array.isArray(obj.recommendations)
        ? obj.recommendations.map((r) => String(r))
        : [],
      severity,
      confidence,
      citations: citations && citations.length > 0 ? citations : undefined,
      request_consult: requestConsult && requestConsult.length > 0 ? requestConsult : undefined,
      raw_data: obj.raw_data as Record<string, unknown> | undefined,
    };
  }
}
