/**
 * Mémoire partagée + archive des sessions agents.
 *
 * Deux responsabilités :
 *   1. Stockage runtime de la SharedSessionMemory (passée entre Supervisor
 *      et sous-agents pendant une session active — purement in-memory).
 *   2. Persistance Firestore du SessionRecord en fin de session, dans
 *      users/{uid}/agent_memory_backup/{sessionId} — backup intégral pour
 *      audit, replay et export local.
 *
 * NB : on n'utilise PAS Firestore comme bus de communication entre agents
 * en cours de session — uniquement pour l'archive finale. Pendant la
 * session, tout reste en mémoire pour éviter les round-trips Firestore.
 */

import 'server-only';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { AGENT_SCHEMA_VERSION } from './types';
import type {
  SessionRecord,
  SharedSessionMemory,
  SubAgentName,
} from './types';

/**
 * Retire récursivement les valeurs `undefined` d'un objet/array.
 * Firestore throw sur `undefined` (sauf si admin init avec ignoreUndefinedProperties).
 * Sans ça, persistSessionRecord échoue silencieusement dès qu'un agent met
 * un champ optionnel à undefined dans raw_data / facts / arbitration.
 */
export function stripUndefined<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value
      .filter((v) => v !== undefined)
      .map((v) => stripUndefined(v)) as unknown as T;
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue;
      out[k] = stripUndefined(v);
    }
    return out as T;
  }
  return value;
}

/**
 * Helpers pour muter la SharedSessionMemory de manière thread-safe pendant
 * une session active. Tous les sous-agents reçoivent la même référence
 * mutable, donc ces helpers documentent l'intention et évitent les bugs.
 */
export const memory = {
  /** Un agent ajoute une note pour les autres */
  addNote(mem: SharedSessionMemory, agent: SubAgentName, note: string): void {
    if (!mem.notes[agent]) mem.notes[agent] = [];
    mem.notes[agent].push(note);
  },

  /** Un agent enregistre un fait extrait de Firestore (poids, énergie, etc.) */
  setFact(mem: SharedSessionMemory, key: string, value: unknown): void {
    mem.facts[key] = value;
  },

  /** Le Supervisor enregistre une décision (pour traçabilité) */
  recordDecision(mem: SharedSessionMemory, decision: string): void {
    mem.decisions.push(decision);
  },

  /** Lecture d'un fait avec type narrowing */
  getFact<T>(mem: SharedSessionMemory, key: string): T | undefined {
    return mem.facts[key] as T | undefined;
  },
};

/**
 * Archive intégrale d'une session agent dans Firestore.
 *
 * Path : users/{uid}/agent_memory_backup/{sessionId}
 * Visibilité : owner (read) + admin SDK (write). Rules Firestore associées
 * doivent matcher /agent_memory_backup/{sessionId}.
 *
 * En cas d'échec d'écriture, on log mais on ne throw pas — la session
 * a déjà délivré sa réponse à l'user, l'archive est secondaire.
 */
export async function persistSessionRecord(record: SessionRecord): Promise<void> {
  try {
    const ref = adminDb
      .collection('users')
      .doc(record.uid)
      .collection('agent_memory_backup')
      .doc(record.session_id);

    // On ajoute un server-side timestamp pour debug même si started_at /
    // finished_at sont fournis par l'app (clocks divergence).
    // stripUndefined : Firestore throw sur undefined, sans ça best-effort
    // catch + swallow masquerait des archives perdues silencieusement.
    await ref.set({
      ...stripUndefined(record),
      _persisted_at: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error('[shared-memory] persistSessionRecord failed:', err);
    // best-effort : on ne propage pas l'erreur, l'user a déjà sa réponse
  }
}

/**
 * Lecture d'une session archivée. Utilisé pour le replay, le debug, et
 * potentiellement par une UI admin.
 */
export async function loadSessionRecord(
  uid: string,
  sessionId: string,
): Promise<SessionRecord | null> {
  try {
    const snap = await adminDb
      .collection('users')
      .doc(uid)
      .collection('agent_memory_backup')
      .doc(sessionId)
      .get();
    if (!snap.exists) return null;
    const data = snap.data();
    if (!data || data.schema_version !== AGENT_SCHEMA_VERSION) {
      console.warn(
        '[shared-memory] loadSessionRecord schema mismatch for',
        sessionId,
        '— got',
        data?.schema_version,
        'expected',
        AGENT_SCHEMA_VERSION,
      );
      return null;
    }
    return data as SessionRecord;
  } catch (err) {
    console.error('[shared-memory] loadSessionRecord failed:', err);
    return null;
  }
}

/**
 * Liste les N dernières sessions agents pour un user — utile pour le
 * MentalCoach (voir l'historique récent) et pour les pages admin.
 */
export async function listRecentSessions(
  uid: string,
  limit = 10,
): Promise<SessionRecord[]> {
  try {
    const snap = await adminDb
      .collection('users')
      .doc(uid)
      .collection('agent_memory_backup')
      .orderBy('started_at', 'desc')
      .limit(limit)
      .get();
    return snap.docs
      .map((d) => d.data())
      .filter(
        (d): d is SessionRecord =>
          d?.schema_version === AGENT_SCHEMA_VERSION,
      );
  } catch (err) {
    console.error('[shared-memory] listRecentSessions failed:', err);
    return [];
  }
}

/**
 * Estime le coût USD d'une session selon les tokens cumulés.
 * Pricing Gemini 3.5 Flash (mai 2026) : $1.50/M input, $9.00/M output.
 * À mettre à jour si on bascule sur un autre modèle.
 */
export function estimateCostUsd(
  tokensInput: number,
  tokensOutput: number,
): number {
  const inputCostPerMillion = 1.5;
  const outputCostPerMillion = 9.0;
  const cost =
    (tokensInput / 1_000_000) * inputCostPerMillion +
    (tokensOutput / 1_000_000) * outputCostPerMillion;
  return Math.round(cost * 100_000) / 100_000; // 5 décimales
}
