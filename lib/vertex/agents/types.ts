/**
 * Types communs aux agents — Multi-Agent System (MAS) pour le coach NoDream.
 *
 * Architecture (cf. docs/BACKLOG.md "Agents & orchestration") :
 *   User message
 *     ↓
 *   Supervisor (route : décide quels sous-agents consulter)
 *     ↓ (en parallèle)
 *   Sous-agents (Nutrition, Training, Analytics, Safety, Mental, Social, Education)
 *     ↓
 *   Supervisor (agrège les outputs → réponse unifiée)
 *     ↓
 *   archive intégrale dans users/{uid}/agent_memory_backup/{sessionId}
 *
 * Chaque agent retourne un AgentOutput structuré (pas du texte libre).
 * Le Supervisor agrège ces outputs en une seule réponse texte pour l'user.
 */

/**
 * Identifiant canonique des sous-agents. Le Supervisor utilise ces noms
 * pour router. Ajouter une nouvelle valeur ici impose d'implémenter
 * l'agent correspondant dans lib/vertex/agents/sub-agents/.
 *
 * **IMPORTANT** : si tu ajoutes un nom, mets-le aussi dans
 * `SUB_AGENT_NAMES` ci-dessous — c'est la source de vérité runtime pour
 * les checks `isValidSubAgentName`. Sans ça, le nouvel agent serait
 * silencieusement filtré par le routing.
 */
export type SubAgentName =
  | 'nutrition'
  | 'training'
  | 'analytics'
  | 'safety'
  | 'mental'
  | 'social'
  | 'education'
  | 'planning';

/**
 * Liste runtime des sous-agents — source de vérité unique pour la
 * validation runtime. Garder synchrone avec le type union ci-dessus.
 */
export const SUB_AGENT_NAMES: readonly SubAgentName[] = [
  'nutrition',
  'training',
  'analytics',
  'safety',
  'mental',
  'social',
  'education',
  'planning',
] as const;

export function isValidSubAgentName(name: unknown): name is SubAgentName {
  return typeof name === 'string' && (SUB_AGENT_NAMES as readonly string[]).includes(name);
}

/** Niveau de confiance d'un sous-agent dans son output. */
export type AgentConfidence = 'low' | 'medium' | 'high';

/** Sévérité d'un signal — utilisé surtout par SafetyCoach pour interruption. */
export type AgentSeverity = 'info' | 'warning' | 'critical';

/**
 * Input passé à chaque sous-agent (par le Supervisor).
 * Le Supervisor peut filtrer/réduire selon le contexte.
 */
export interface AgentInput {
  /** Identifiant de la session courante (pour tracing + corrélation logs) */
  session_id: string;
  /** UID Firebase du user — sert pour fetch des données spécifiques au domaine */
  uid: string;
  /** Le message user qui a déclenché la session */
  user_message: string;
  /** Raison pour laquelle le Supervisor a consulté CET agent (debug + prompt) */
  reason_for_consult: string;
  /** Historique chat récent (5-10 derniers messages), facultatif */
  recent_chat?: Array<{ role: 'user' | 'assistant'; content: string }>;
  /** Mémoire partagée de la session courante (read-only ici) */
  shared_memory?: SharedSessionMemory;
}

/**
 * Output structuré d'un sous-agent. Le Supervisor lit ces champs pour
 * arbitrer et agréger. JAMAIS de texte libre seul — toujours structuré.
 */
export interface AgentOutput {
  /** Identifiant de l'agent qui a produit cet output */
  agent: SubAgentName;
  /** Diagnostic / observation de l'agent dans son domaine */
  diagnostic: string;
  /** Recommandation(s) concrète(s) que l'agent propose */
  recommendations: string[];
  /** Citations / références scientifiques que l'agent veut mentionner (si applicable) */
  citations?: Array<{ label: string; url?: string }>;
  /** Sévérité globale du signal (warning/critical = peut interrompre le flow) */
  severity: AgentSeverity;
  /** Niveau de confiance de l'agent dans son analyse */
  confidence: AgentConfidence;
  /** Demande explicite au Supervisor (ex: "demande à TrainingCoach de confirmer") */
  request_consult?: SubAgentName[];
  /** Données brutes que l'agent veut faire passer au Supervisor (debug + audit) */
  raw_data?: Record<string, unknown>;
  /** Tokens consommés par cet agent (pour cost tracking) */
  tokens?: { input: number; output: number };
  /** Durée d'exécution en ms */
  duration_ms?: number;
  /** Erreur si l'agent n'a pas pu produire un output utile */
  error?: string;
}

/**
 * Mémoire partagée mutable durant une session. Les agents peuvent y
 * lire ET écrire (mais le Supervisor centralise les écritures pour éviter
 * les races). Persistée à la fin de la session dans le SessionRecord.
 */
export interface SharedSessionMemory {
  /** Notes laissées par chaque agent pour les autres (ex: SafetyCoach signale TCA) */
  notes: Record<SubAgentName, string[]>;
  /** Faits collectés depuis Firestore (poids actuel, dernière session, etc.) */
  facts: Record<string, unknown>;
  /** Décisions prises par le Supervisor au cours de la session */
  decisions: string[];
}

/**
 * Décision de routing prise par le Supervisor à l'étape 1.
 * "consulter ces N sous-agents avec ces raisons précises".
 */
export interface RoutingDecision {
  /** Liste des sous-agents à consulter (1-N) */
  sub_agents: Array<{ name: SubAgentName; reason_for_consult: string }>;
  /** Raisonnement du Supervisor — pour audit */
  reasoning: string;
  /** Le Supervisor peut décider de répondre sans consulter (réponse triviale) */
  skip_sub_agents?: boolean;
  /** Réponse directe si skip_sub_agents = true */
  direct_response?: string;
}

/**
 * Archive intégrale d'une session agent — persistée dans
 * users/{uid}/agent_memory_backup/{sessionId}.
 * Permet le replay, l'audit, le debug, et l'export local.
 */
export interface SessionRecord {
  /** Identifiant unique de la session (auto-id Firestore) */
  session_id: string;
  /** UID du user concerné */
  uid: string;
  /** Timestamp de début ISO 8601 */
  started_at: string;
  /** Timestamp de fin ISO 8601 */
  finished_at: string;
  /** Durée totale en ms (incluant supervisor + tous sous-agents) */
  total_duration_ms: number;
  /** Message user qui a déclenché la session */
  user_message: string;
  /** Décision de routing prise par le Supervisor */
  routing: RoutingDecision;
  /** Outputs de chaque sous-agent consulté (clé = agent name) */
  sub_agent_outputs: Partial<Record<SubAgentName, AgentOutput>>;
  /** Si désaccords entre agents : trace de l'arbitration */
  arbitration?: {
    disagreements: string[];
    resolution: string;
  };
  /** Réponse finale unifiée envoyée à l'user */
  final_response: string;
  /** Mémoire partagée à la fin de la session (snapshot) */
  shared_memory: SharedSessionMemory;
  /** Tokens cumulés sur tous les appels Gemini de la session */
  tokens_total: { input: number; output: number };
  /** Estimation du coût USD (Flash 3.5 pricing : ~$1.50/M input, $9/M output) */
  cost_estimate_usd: number;
  /** Erreur fatale au niveau session (si tout a échoué) */
  error?: string;
  /** Version du système agent (pour migrations futures) */
  schema_version: number;
}

/** Version actuelle du schema SessionRecord. À incrémenter sur breaking change. */
export const AGENT_SCHEMA_VERSION = 1;

/**
 * Initialise une mémoire partagée vide pour une nouvelle session.
 */
export function createEmptySharedMemory(): SharedSessionMemory {
  return {
    notes: {
      nutrition: [],
      training: [],
      analytics: [],
      safety: [],
      mental: [],
      social: [],
      education: [],
      planning: [],
    },
    facts: {},
    decisions: [],
  };
}
