/**
 * resolveProfileSnapshot — lecture du profil normalisé pour un sous-agent.
 *
 * Anti-N+1 : le Supervisor précharge le profil UNE seule fois par session
 * (cf. supervisor.runAgentSession) et le passe dans `input.profile`. Les
 * sous-agents lisent de là au lieu de re-fetch le même doc Firestore chacun
 * (avant : 1 lecture × N agents consultés).
 *
 * Fallback : si `input.profile` est absent — appel direct d'un agent, test
 * unitaire, ou préchargement superviseur en échec — on fait un fetch
 * individuel. Le comportement reste donc strictement correct hors
 * orchestration, et identique au legacy en cas d'erreur de préchargement.
 */

import {
  getUserProfileSnapshot,
  type NormalizedProfile,
} from '@/lib/features/user-profile/snapshot';
import type { AgentInput } from './types';

export async function resolveProfileSnapshot(
  input: AgentInput,
): Promise<NormalizedProfile> {
  const preloaded = input.profile;
  if (preloaded) return preloaded;
  return getUserProfileSnapshot(input.uid);
}
