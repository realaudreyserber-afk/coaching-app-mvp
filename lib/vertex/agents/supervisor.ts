/**
 * Supervisor — orchestrateur du Multi-Agent System.
 *
 * Flow d'une session :
 *   1. Génère un sessionId, initialise shared memory
 *   2. Étape ROUTE : appelle Gemini avec supervisor prompt → RoutingDecision
 *   3. Si skip_sub_agents : early-return avec direct_response
 *   4. Étape EXECUTE : instancie chaque agent décidé, Promise.all run
 *   5. Étape ARBITRATION : si SafetyCoach a severity=critical → ses recos
 *      overrident tout (basic Phase 1 — arbitration complète en Phase 5)
 *   6. Étape AGGREGATE : appelle Gemini avec outputs → texte unifié pour user
 *   7. Étape ARCHIVE : persiste SessionRecord dans Firestore
 *   8. Retourne { finalResponse, sessionRecord }
 *
 * En cas d'erreur : on log + on retourne un fallback textuel pour ne pas
 * casser l'expérience user. L'archive est best-effort.
 */

import 'server-only';
import { generateTextWithUsage, parseLLMJson } from '../client';
import { SUPERVISOR_SYSTEM_PROMPT } from '../prompts/agents/supervisor';
import { getSubAgent } from './sub-agents';
import { persistSessionRecord, estimateCostUsd } from './shared-memory';
import { generateSessionId, tracer } from './tracing';
import {
  getUserProfileSnapshot,
  type NormalizedProfile,
} from '@/lib/features/user-profile/snapshot';
import {
  AGENT_SCHEMA_VERSION,
  createEmptySharedMemory,
  isValidSubAgentName,
  type AgentInput,
  type AgentOutput,
  type RoutingDecision,
  type SessionRecord,
  type SubAgentName,
} from './types';

const SUPERVISOR_MODEL = 'gemini-3.5-flash';

export interface RunAgentSessionInput {
  uid: string;
  user_message: string;
  recent_chat?: Array<{ role: 'user' | 'assistant'; content: string }>;
  /**
   * Callback optionnel pour exposer les phases du flow au caller.
   * Utilisé par la route SSE pour streamer des progress events au client
   * (route_decided → agent_start/finish → aggregate_start → session_finish).
   * Fire-and-forget — si le callback throw, on ignore (log).
   */
  onPhase?: (event: PhaseEvent) => void;
}

export type PhaseEvent =
  | { type: 'route_decided'; agents: SubAgentName[]; skip: boolean; reasoning: string }
  | { type: 'agent_start'; agent: SubAgentName; reason: string }
  | { type: 'agent_finish'; agent: SubAgentName; severity: AgentOutput['severity']; duration_ms: number }
  | { type: 'aggregate_start' }
  | {
      type: 'session_finish';
      session_id: string;
      total_duration_ms: number;
      tokens_total: { input: number; output: number };
      cost_estimate_usd: number;
      agents_consulted: SubAgentName[];
    };

export interface RunAgentSessionResult {
  finalResponse: string;
  sessionRecord: SessionRecord;
}

function safeEmit(cb: RunAgentSessionInput['onPhase'], evt: PhaseEvent): void {
  if (!cb) return;
  try {
    cb(evt);
  } catch (e) {
    console.warn('[supervisor] onPhase callback threw, ignoring:', e);
  }
}

/**
 * Point d'entrée principal du Supervisor. Appelé par la route
 * /api/ai/coach-multi (à créer Phase 4).
 */
export async function runAgentSession(
  input: RunAgentSessionInput,
): Promise<RunAgentSessionResult> {
  const session_id = generateSessionId();
  const started_at = new Date().toISOString();
  const sharedMemory = createEmptySharedMemory();
  const trace = tracer.forSession(session_id, input.uid);

  let tokensInputTotal = 0;
  let tokensOutputTotal = 0;
  let fatalError: string | undefined;
  let routingDecision: RoutingDecision = { sub_agents: [], reasoning: '' };
  let subOutputs: Partial<Record<SubAgentName, AgentOutput>> = {};
  let finalResponse = '';
  let arbitration: SessionRecord['arbitration'];

  try {
    trace.supervisor('session_start', 'info', { user_message_len: input.user_message.length });

    // 1. Étape ROUTE
    const routePrompt = buildRoutePrompt(input);
    const routeResult = await generateTextWithUsage({
      model: SUPERVISOR_MODEL,
      systemInstruction: SUPERVISOR_SYSTEM_PROMPT,
      contents: [{ role: 'user', parts: [{ text: routePrompt }] }],
      temperature: 0.2,
      responseMimeType: 'application/json',
    });
    tokensInputTotal += routeResult.tokens.input;
    tokensOutputTotal += routeResult.tokens.output;

    routingDecision = parseRoutingDecision(routeResult.text);
    trace.supervisor('route_decided', 'info', {
      sub_agents: routingDecision.sub_agents.map((s) => s.name),
      skip: routingDecision.skip_sub_agents ?? false,
    });
    safeEmit(input.onPhase, {
      type: 'route_decided',
      agents: routingDecision.sub_agents.map((s) => s.name),
      skip: routingDecision.skip_sub_agents ?? false,
      reasoning: routingDecision.reasoning,
    });

    // 2. Skip path
    if (routingDecision.skip_sub_agents) {
      finalResponse =
        routingDecision.direct_response ??
        "D'accord, je suis là si tu veux.";
      return finalize();
    }

    // 3. Étape EXECUTE — parallèle
    const validAgents = routingDecision.sub_agents.filter((a) =>
      isValidSubAgentName(a.name),
    );
    if (validAgents.length === 0) {
      finalResponse = "J'ai pris en compte ton message, dis-m'en plus si besoin.";
      return finalize();
    }

    // Anti-N+1 : le profil est chargé UNE fois ici (au lieu d'être re-fetch par
    // chaque sous-agent), puis injecté dans chaque AgentInput. Les agents le
    // lisent via resolveProfileSnapshot(). Best-effort : si le chargement échoue,
    // chaque agent retombe sur son fetch individuel (fallback = comportement legacy).
    // Placé après les early-returns (skip / 0 agent) → pas de lecture inutile.
    let preloadedProfile: NormalizedProfile | null = null;
    try {
      preloadedProfile = await getUserProfileSnapshot(input.uid);
    } catch (e) {
      trace.supervisor('profile_preload_failed', 'warn', { err: String(e) });
    }

    const runs = await Promise.all(
      validAgents.map(async ({ name, reason_for_consult }) => {
        safeEmit(input.onPhase, { type: 'agent_start', agent: name, reason: reason_for_consult });
        const agentInput: AgentInput = {
          session_id,
          uid: input.uid,
          user_message: input.user_message,
          reason_for_consult,
          recent_chat: input.recent_chat,
          shared_memory: sharedMemory,
          profile: preloadedProfile,
        };
        const agent = getSubAgent(name);
        const output = await agent.run(agentInput, sharedMemory);
        safeEmit(input.onPhase, {
          type: 'agent_finish',
          agent: name,
          severity: output.severity,
          duration_ms: output.duration_ms ?? 0,
        });
        return output;
      }),
    );

    for (const out of runs) {
      subOutputs[out.agent] = out;
      tokensInputTotal += out.tokens?.input ?? 0;
      tokensOutputTotal += out.tokens?.output ?? 0;
    }

    // 4. Étape ARBITRATION (minimaliste Phase 1)
    arbitration = arbitrateOutputs(subOutputs);

    // 5. Étape AGGREGATE
    safeEmit(input.onPhase, { type: 'aggregate_start' });
    const aggregatePrompt = buildAggregatePrompt(input, subOutputs, arbitration);
    const aggregateResult = await generateTextWithUsage({
      model: SUPERVISOR_MODEL,
      systemInstruction: SUPERVISOR_SYSTEM_PROMPT,
      contents: [{ role: 'user', parts: [{ text: aggregatePrompt }] }],
      temperature: 0.4,
      // Pas de responseMimeType JSON ici — sortie texte libre coach
    });
    tokensInputTotal += aggregateResult.tokens.input;
    tokensOutputTotal += aggregateResult.tokens.output;
    finalResponse = aggregateResult.text.trim();

    if (!finalResponse) {
      finalResponse = "Je n'ai pas réussi à formuler une réponse claire. Reformule ?";
    }

    return finalize();
  } catch (err) {
    fatalError = err instanceof Error ? err.message : String(err);
    await trace.captureError(err, 'supervisor');
    finalResponse =
      finalResponse ||
      "Une erreur interne est survenue. Réessaie dans un instant — si ça persiste, contacte le support.";
    return finalize();
  }

  /** Finalise et persiste le SessionRecord. Best-effort. */
  function finalize(): RunAgentSessionResult {
    const finished_at = new Date().toISOString();
    const total_duration_ms =
      new Date(finished_at).getTime() - new Date(started_at).getTime();

    const record: SessionRecord = {
      session_id,
      uid: input.uid,
      started_at,
      finished_at,
      total_duration_ms,
      user_message: input.user_message,
      routing: routingDecision,
      sub_agent_outputs: subOutputs,
      arbitration,
      final_response: finalResponse,
      shared_memory: sharedMemory,
      tokens_total: { input: tokensInputTotal, output: tokensOutputTotal },
      cost_estimate_usd: estimateCostUsd(tokensInputTotal, tokensOutputTotal),
      error: fatalError,
      schema_version: AGENT_SCHEMA_VERSION,
    };

    // Fire-and-forget : si l'archive échoue, l'user a déjà sa réponse
    void persistSessionRecord(record).catch((e) => {
      trace.supervisor('persist_failed', 'error', { err: String(e) });
    });

    trace.supervisor('session_finish', 'info', {
      total_duration_ms,
      tokens_total: tokensInputTotal + tokensOutputTotal,
      cost_usd: record.cost_estimate_usd,
      agents_consulted: Object.keys(subOutputs),
    });
    safeEmit(input.onPhase, {
      type: 'session_finish',
      session_id,
      total_duration_ms,
      tokens_total: record.tokens_total,
      cost_estimate_usd: record.cost_estimate_usd,
      agents_consulted: Object.keys(subOutputs) as SubAgentName[],
    });

    return { finalResponse, sessionRecord: record };
  }
}

/**
 * Build le userPrompt pour l'étape ROUTE du Supervisor.
 */
function buildRoutePrompt(input: RunAgentSessionInput): string {
  const recentChat = input.recent_chat?.slice(-6) ?? [];
  return (
    `[ÉTAPE: route]\n\n` +
    `[MESSAGE USER ACTUEL]\n${input.user_message}\n\n` +
    `[HISTORIQUE RÉCENT]\n${
      recentChat.length > 0
        ? recentChat
            .map((m) => `${m.role}: ${m.content}`)
            .join('\n')
        : '(aucun historique récent)'
    }\n\n` +
    `Décide quels sous-agents consulter et retourne le JSON RoutingDecision.`
  );
}

/**
 * Build le userPrompt pour l'étape AGGREGATE.
 */
function buildAggregatePrompt(
  input: RunAgentSessionInput,
  outputs: Partial<Record<SubAgentName, AgentOutput>>,
  arbitration: SessionRecord['arbitration'],
): string {
  // On n'inclut PAS les agents en error dans le prompt aggregate :
  // sinon le Supervisor risque de leak "L'agent X a échoué" à l'user.
  // L'erreur est tracée séparément et persistée dans SessionRecord.
  const outputsSummary = Object.entries(outputs)
    .filter(([, out]) => out && !out.error)
    .map(([name, out]) => {
      if (!out) return '';
      return (
        `\n--- AGENT: ${name} (severity: ${out.severity}, confidence: ${out.confidence}) ---\n` +
        `DIAGNOSTIC: ${out.diagnostic}\n` +
        `RECOMMENDATIONS:\n${out.recommendations.map((r, i) => `  ${i + 1}. ${r}`).join('\n')}\n` +
        (out.citations && out.citations.length > 0
          ? `CITATIONS: ${out.citations.map((c) => c.label).join(' | ')}\n`
          : '')
      );
    })
    .filter(Boolean)
    .join('\n');

  const arbitrationBlock = arbitration
    ? `\n[ARBITRATION]\n${arbitration.disagreements.length > 0 ? `Désaccords: ${arbitration.disagreements.join('; ')}\n` : ''}Résolution: ${arbitration.resolution}\n`
    : '';

  return (
    `[ÉTAPE: aggregate]\n\n` +
    `[MESSAGE USER]\n${input.user_message}\n\n` +
    `[OUTPUTS DES SOUS-AGENTS]\n${outputsSummary || '(aucun output utilisable)'}\n` +
    arbitrationBlock +
    `\nAssemble une réponse unifiée pour l'user dans la voix coach NoDream. ` +
    `Pas de mention des agents ni de l'architecture interne. Tutoiement. Pas le mot "régime". ` +
    `Si severity=critical sur safety, sa réponse prime — ton sérieux, redirection pro santé. ` +
    `Si aucun output utilisable : "Je n'ai pas réussi à analyser ta question, peux-tu reformuler ?".`
  );
}

/**
 * Parse + valide le RoutingDecision retourné par Gemini.
 * Fallback safe si parse fail : on consulte personne et on dit qu'on a pas compris.
 */
export function parseRoutingDecision(raw: string): RoutingDecision {
  try {
    const parsed = parseLLMJson<{
      sub_agents?: unknown;
      reasoning?: unknown;
      skip_sub_agents?: unknown;
      direct_response?: unknown;
    }>(raw);

    // Defensive : Gemini peut retourner sub_agents en string ou autre type
    // au lieu d'un array. Sans Array.isArray, on crash sur .map().
    const rawAgents = Array.isArray(parsed.sub_agents) ? parsed.sub_agents : [];
    const subAgents = rawAgents
      .filter((a): a is Record<string, unknown> => a !== null && typeof a === 'object')
      .map((a) => ({
        name: a.name,
        reason_for_consult:
          typeof a.reason_for_consult === 'string' ? a.reason_for_consult : '',
      }))
      .filter((a): a is { name: SubAgentName; reason_for_consult: string } =>
        typeof a.name === 'string' && isValidSubAgentName(a.name),
      );

    return {
      sub_agents: subAgents,
      reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
      skip_sub_agents: !!parsed.skip_sub_agents,
      direct_response:
        typeof parsed.direct_response === 'string' ? parsed.direct_response : undefined,
    };
  } catch (err) {
    console.warn('[supervisor] parseRoutingDecision failed:', err);
    return {
      sub_agents: [],
      reasoning: 'parse_failed',
      skip_sub_agents: true,
      direct_response:
        "Je n'ai pas bien interprété ta question. Tu peux reformuler en quelques mots ?",
    };
  }
}

/**
 * Arbitration minimaliste Phase 1 :
 *  - Si SafetyCoach severity=critical → on note l'override
 *  - Si plusieurs agents disent severity=critical (rare mais possible) → on note
 *  - Phase 5 ajoutera désaccord détection (recos contradictoires nutrition vs training)
 */
export function arbitrateOutputs(
  outputs: Partial<Record<SubAgentName, AgentOutput>>,
): SessionRecord['arbitration'] | undefined {
  const disagreements: string[] = [];
  const criticalAgents = Object.values(outputs)
    .filter((o): o is AgentOutput => !!o && o.severity === 'critical')
    .map((o) => o.agent);

  if (outputs.safety?.severity === 'critical') {
    return {
      disagreements,
      resolution:
        'SafetyCoach a flag critical : ses recommandations prennent le pas sur les autres agents.',
    };
  }

  if (criticalAgents.length > 1) {
    disagreements.push(
      `Plusieurs agents en critical: ${criticalAgents.join(', ')}`,
    );
    return {
      disagreements,
      resolution:
        'Plusieurs critical sans safety — escalade au coach, ton sérieux dans la réponse.',
    };
  }

  return undefined;
}

