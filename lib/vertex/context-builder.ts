/**
 * Unified prompt-enrichment builder.
 *
 * The MVP's Vertex AI coaching engine already produces contextual narrative
 * (e.g. `plans/{planId}.lifestyle_notes`). V1 extension modules MUST extend
 * this engine rather than build parallel pipelines.
 *
 * Reused by:
 *   - /api/ai/coach           (conversational, SSE)
 *   - /api/ai/generate-plan   (initial plan generation)
 *   - /api/ai/weekly-review   (Sunday review)
 *   - /api/ai/daily-insight   (post-checkin insight)
 *   - functions/smart-notifications-cron (FCM personalized templates)
 *
 * Adding a new context block requires:
 *   1. Add field to UserContext
 *   2. Add a BLOCK builder fn + register it in `buildEnrichedSystemPrompt`
 *   3. Update tests in context-builder.test.ts
 */

import type { SearchResult } from '@/lib/features/rag-sourcing/client';
import type { ProfilePath } from '@/lib/features/profile-paths/schema';

// =====================================================================
// Type definitions (snake_case as per ADR-006)
// =====================================================================

export interface UserProfile {
  name?: string;
  age?: number; // optional; if absent, derived from dob
  dob?: string; // ISO date — set by wizard Step2
  height?: number;
  weight?: number;
  sex?: 'male' | 'female' | 'other';
  activity_level?: string;
  training_frequency?: string;
  training_history?: string;
  tdee_theoretical?: number;
  tdee_adaptive?: number;
  // Mesures complémentaires (collectées par le coach en chat)
  waist_cm?: number;
  neck_cm?: number;
  hips_cm?: number;
  bf_method?: string; // "dexa" | "inbody" | "caliper" | "navy" | "bia" | "photo" | "unknown"
  hormonal_context?: string; // "natural" | "trt" | "cycle" | "post_menopause"
  medical_notes?: string;
}

function ageFromDob(dob?: string): number | undefined {
  if (!dob) return undefined;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return undefined;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

export interface UserBaseline {
  weight?: number;
  bf_pct?: number;
  bf_measured_at?: string;
}

export interface UserGoals {
  primary_goal?: string;
  target_weight?: number;
  target_bf_pct?: number;
  type?: string;
  deadline?: string;
}

export interface GLP1State {
  active: boolean;
  molecule?: string;
  dose?: string;
  frequency?: string;
  start_date?: string;
  side_effects?: string[];
}

export interface FastingProtocol {
  active: boolean;
  type?: string;
  eating_window_start?: string;
  eating_window_end?: string;
  days_active?: string[];
}

export interface BloodworkSummary {
  date?: string;
  summary?: string;
  markers?: Array<{
    name: string;
    value: string | number;
    unit?: string;
    reference_range?: string;
    status?: 'normal' | 'low' | 'high' | 'critical';
  }>;
}

export interface ActivePlanSummary {
  kcal?: number;
  macros?: { p?: number; c?: number; f?: number };
  strategy_nutrition?: string;
  strategy_training?: string;
}

export interface NotificationContext {
  has_checkin_today?: boolean;
  in_fasting_window?: boolean;
  recent_plateau?: boolean;
  hour_local?: number;
}

export interface UserContext {
  profile?: UserProfile;
  baseline?: UserBaseline;
  goals?: UserGoals;
  profile_path?: ProfilePath;
  active_plan?: ActivePlanSummary;
  glp1?: GLP1State;
  fasting?: FastingProtocol;
  bloodwork?: BloodworkSummary;
  rag_sources?: SearchResult[];
  notification_context?: NotificationContext;
}

// =====================================================================
// Block builders (one per concern, snake_case keys)
// =====================================================================

function profileBlock(ctx: UserContext): string {
  if (!ctx.profile && !ctx.baseline && !ctx.goals) return '';
  const p = ctx.profile;
  const b = ctx.baseline;
  const g = ctx.goals;

  // Derive age from dob if not provided directly
  const computedAge = p?.age ?? ageFromDob(p?.dob);

  // Compute what's still missing — the coach will be told to collect it.
  const missing: string[] = [];
  if (!p?.name) missing.push('prénom');
  if (!computedAge) missing.push('âge');
  if (!p?.sex) missing.push('sexe biologique');
  if (!p?.height) missing.push('taille (cm)');
  if (!(p?.weight ?? b?.weight)) missing.push('poids actuel (kg)');
  if (!p?.activity_level) missing.push('NEAT / activité hors sport');
  if (!p?.training_frequency) missing.push('fréquence et type d\'entraînement');
  if (!g?.primary_goal && !g?.type) missing.push('objectif principal');
  if (!b?.bf_pct && !p?.bf_method) missing.push('body fat % (ou méthode pour le mesurer)');

  const missingBlock = missing.length
    ? `\n⚠️ DONNÉES MANQUANTES À COLLECTER EN CONVERSATION (par ordre de priorité) :\n${missing.map((m) => `  - ${m}`).join('\n')}\n\nAccueille l'utilisateur, valide les données déjà connues, puis collecte celles-ci. Une question à la fois, en conversation naturelle. Ne génère AUCUN plan calorique tant que les données minimales (taille, poids, âge, sexe, NEAT, objectif) ne sont pas connues. Pour le body fat, déclenche le workflow §7 (Q1-Q5).`
    : '\n✅ Toutes les données critiques sont collectées. Tu peux raisonner pleinement.';

  return `
PROFIL DE L'UTILISATEUR :
- Prénom : ${p?.name ?? '(à demander)'}
- Sexe biologique : ${p?.sex ?? '(à demander)'}
- Âge : ${computedAge ? `${computedAge} ans` : '(à demander)'}
- Taille : ${p?.height ? `${p.height} cm` : '(à demander)'}
- Poids actuel : ${(p?.weight ?? b?.weight) ? `${p?.weight ?? b?.weight} kg` : '(à demander)'}
- NEAT / activité hors sport : ${p?.activity_level ?? '(à demander)'}
- Fréquence training : ${p?.training_frequency ?? '(à demander)'}
- Historique training : ${p?.training_history ?? '(non précisé)'}
- Objectif principal : ${g?.primary_goal ?? g?.type ?? '(à demander)'}
- Poids cible : ${g?.target_weight ? `${g.target_weight} kg` : '(non précisé)'}
- BF actuel : ${b?.bf_pct ? `${b.bf_pct}% (mesuré ${b.bf_measured_at ?? 'date inconnue'}, méthode ${p?.bf_method ?? 'non précisée'})` : '(non mesuré — voir §7 du prompt)'}
- BF cible : ${g?.target_bf_pct ? `${g.target_bf_pct}%` : '(non précisé)'}
- Tour de taille : ${p?.waist_cm ? `${p.waist_cm} cm` : '(non mesuré)'}
- Tour de cou : ${p?.neck_cm ? `${p.neck_cm} cm` : '(non mesuré)'}
${p?.hips_cm ? `- Tour de hanches : ${p.hips_cm} cm` : ''}
- Contexte hormonal : ${p?.hormonal_context ?? 'naturel (à confirmer)'}
- Notes médicales : ${p?.medical_notes ?? '(aucune signalée)'}
- TDEE théorique : ${p?.tdee_theoretical ? `${p.tdee_theoretical} kcal` : '(à calculer)'}
- TDEE adaptatif : ${p?.tdee_adaptive ? `${p.tdee_adaptive} kcal (PRIORITÉ sur le théorique)` : '(non calibré)'}
${missingBlock}
`;
}

function activePlanBlock(ctx: UserContext): string {
  const p = ctx.active_plan;
  if (!p) return '\nAucun plan nutritionnel actif.\n';
  return `
PLAN NUTRITIONNEL ACTIF :
- Calories : ${p.kcal ?? '?'} kcal/jour
- Macros : ${p.macros?.p ?? '?'}g P / ${p.macros?.c ?? '?'}g C / ${p.macros?.f ?? '?'}g F
- Stratégie nutrition : ${p.strategy_nutrition ?? 'non précisée'}
- Stratégie training : ${p.strategy_training ?? 'non précisée'}
`;
}

function profilePathBlock(ctx: UserContext): string {
  if (!ctx.profile_path || ctx.profile_path === 'standard') return '';
  return `\n[PARCOURS PROFIL : ${ctx.profile_path.toUpperCase()}]\nAdapte tes conseils aux spécificités de ce parcours.\n`;
}

function glp1Block(ctx: UserContext): string {
  const g = ctx.glp1;
  if (!g?.active) return '';
  return `
[TRAITEMENT GLP-1 ACTIF : ${g.molecule?.toUpperCase() ?? 'INCONNU'}]
- Dose : ${g.dose ?? 'N/A'}, fréquence : ${g.frequency ?? 'hebdo'}
- Date début : ${g.start_date ?? 'N/A'}
- Effets ressentis : ${g.side_effects?.join(', ') ?? 'aucun signalé'}

CONSIGNES NUTRITION/SAFETY GLP-1 :
1. Risque fonte musculaire : cible protéines +20% (viser 2.0-2.2g/kg poids corps).
2. Nausées : portions fractionnées, éviter gras/sucré, hydratation par gorgées.
3. Disclaimer médical : rappel régulier que tes conseils ne remplacent pas le médecin prescripteur.
`;
}

function fastingBlock(ctx: UserContext): string {
  const f = ctx.fasting;
  if (!f?.active) return '';
  return `
[JEÛNE INTERMITTENT ACTIF : ${f.type ?? '16:8'}]
- Fenêtre repas : ${f.eating_window_start ?? '12h'} → ${f.eating_window_end ?? '20h'}
- Jours actifs : ${f.days_active?.join(', ') ?? 'tous'}
Adapte les recommandations repas à cette fenêtre. Hors fenêtre : eau, thé/café noir.
`;
}

function bloodworkBlock(ctx: UserContext): string {
  const bw = ctx.bloodwork;
  if (!bw) return '';
  const markersStr =
    bw.markers
      ?.map((m) => `  - ${m.name} : ${m.value} ${m.unit ?? ''} (réf : ${m.reference_range ?? 'N/A'}) [${m.status ?? 'unknown'}]`)
      .join('\n') ?? '  (aucun marqueur extrait)';
  return `
[DERNIER BILAN SANGUIN — DATE : ${bw.date ?? 'N/A'}]
Résumé : ${bw.summary ?? 'N/A'}
Marqueurs :
${markersStr}

Adapte tes conseils pour soutenir ces biomarqueurs (ex: LDL élevé → graisses insaturées, avoine, fibres).
Ne pose JAMAIS de diagnostic. Recommande consultation médicale pour toute valeur critique.
`;
}

function ragBlock(ctx: UserContext): string {
  const sources = ctx.rag_sources;
  if (!sources?.length) return '';
  const sourcesStr = sources
    .map(
      (r, i) =>
        `[Source #${i + 1}] ${r.title}\nAuteurs: ${r.authors} | ${r.source} (${r.year})\nLien: ${r.url}`
    )
    .join('\n\n');
  return `
SOURCES SCIENTIFIQUES DISPONIBLES POUR CETTE RÉPONSE :
${sourcesStr}

RÈGLES DE CITATION :
- Cite tes sources quand tu affirmes un fait scientifique : "Selon [Auteurs] ([Année]) [Source #X]"
- N'invente AUCUNE source en dehors de cette liste.
- Si aucune source ne correspond, réponds avec tes connaissances générales sans citer.
`;
}

function notificationBlock(ctx: UserContext): string {
  const n = ctx.notification_context;
  if (!n) return '';
  const hints: string[] = [];
  if (n.has_checkin_today === false) hints.push("- L'utilisateur n'a PAS fait son check-in du jour.");
  if (n.in_fasting_window === true) hints.push("- L'utilisateur est dans sa fenêtre de jeûne actuellement.");
  if (n.recent_plateau === true) hints.push("- L'utilisateur est sur un plateau de poids depuis 2+ semaines.");
  if (typeof n.hour_local === 'number') hints.push(`- Heure locale : ${n.hour_local}h.`);
  if (!hints.length) return '';
  return `\nCONTEXTE NOTIFICATION :\n${hints.join('\n')}\n`;
}

// =====================================================================
// Public API
// =====================================================================

export interface EnrichOptions {
  includeProfile?: boolean;
  includeActivePlan?: boolean;
  includeProfilePath?: boolean;
  includeGlp1?: boolean;
  includeFasting?: boolean;
  includeBloodwork?: boolean;
  includeRag?: boolean;
  includeNotification?: boolean;
}

const DEFAULT_OPTS: Required<EnrichOptions> = {
  includeProfile: true,
  includeActivePlan: true,
  includeProfilePath: true,
  includeGlp1: true,
  includeFasting: true,
  includeBloodwork: true,
  includeRag: true,
  includeNotification: false,
};

/**
 * Build an enriched system prompt by appending context blocks to the base prompt.
 * Each block is opt-in via options (some routes don't need all blocks).
 */
export function buildEnrichedSystemPrompt(
  basePrompt: string,
  ctx: UserContext,
  opts: EnrichOptions = {}
): string {
  const o = { ...DEFAULT_OPTS, ...opts };
  const parts: string[] = [basePrompt];

  if (o.includeProfile) parts.push(profileBlock(ctx));
  if (o.includeActivePlan) parts.push(activePlanBlock(ctx));
  if (o.includeProfilePath) parts.push(profilePathBlock(ctx));
  if (o.includeGlp1) parts.push(glp1Block(ctx));
  if (o.includeFasting) parts.push(fastingBlock(ctx));
  if (o.includeBloodwork) parts.push(bloodworkBlock(ctx));
  if (o.includeRag) parts.push(ragBlock(ctx));
  if (o.includeNotification) parts.push(notificationBlock(ctx));

  return parts.filter((p) => p && p.trim().length > 0).join('\n');
}

/**
 * Materialize a UserContext from a Firestore user doc (post-ADR-006 schema)
 * + optional injections from feature-specific fetches.
 *
 * Caller is responsible for fetching the doc and any subcollections it needs.
 */
export interface BuildContextInput {
  userData?: Record<string, any>;
  activePlan?: Record<string, any>;
  bloodwork?: Record<string, any>;
  ragSources?: SearchResult[];
  notificationContext?: NotificationContext;
}

export function buildUserContext(input: BuildContextInput): UserContext {
  const u = input.userData ?? {};
  const ap = input.activePlan;

  return {
    profile: u.profile,
    baseline: u.baseline,
    goals: u.goals,
    profile_path: u.profile_path,
    active_plan: ap
      ? {
          kcal: ap.kcal,
          macros: ap.macros,
          strategy_nutrition: ap.strategy_nutrition,
          strategy_training: ap.strategy_training,
        }
      : undefined,
    glp1: u.medical?.glp1 ?? undefined,
    fasting: u.fasting_protocol ?? undefined,
    bloodwork: input.bloodwork,
    rag_sources: input.ragSources,
    notification_context: input.notificationContext,
  };
}
