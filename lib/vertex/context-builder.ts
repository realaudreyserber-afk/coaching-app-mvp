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
  // Mensurations complémentaires (Adonis ratio, McCallum §12 du coach)
  shoulder_cm?: number;
  chest_cm?: number;
  arm_cm?: number;
  forearm_cm?: number;
  wrist_cm?: number;
  thigh_cm?: number;
  calf_cm?: number;
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

export interface ActivePlanSummaryExercise {
  name: string;
  sets: number;
  reps: string;
  rest_seconds: number;
  superset_group?: string;
}

export interface ActivePlanSummarySession {
  name: string;
  frequency_weekly: number;
  exercises: ActivePlanSummaryExercise[];
}

export interface ActivePlanSummary {
  kcal?: number;
  macros?: { p?: number; c?: number; f?: number };
  strategy_nutrition?: string;
  strategy_training?: string;
  /**
   * Wave 9 follow-up — sessions + exercises are now injected so the coach
   * can resolve patch targets like `training.sessions.X.exercises.Y.name`
   * when the user asks for a substitution. Without this, the coach knows
   * only the macro shape and can't trigger <COACH_PLAN_PATCH> on exo swaps.
   */
  sessions?: ActivePlanSummarySession[];
}

export interface NotificationContext {
  has_checkin_today?: boolean;
  in_fasting_window?: boolean;
  recent_plateau?: boolean;
  hour_local?: number;
}

// ---- Wave 5A : context enrichments ---------------------------------------

export interface LastSessionSummary {
  session_id: string;
  session_code: string;
  operation_name: string;
  finished_at: string;
  duration_seconds: number;
  volume_kg: number;
  completion_pct: number;
  vs_previous_volume_pct?: number;
  top_lift?: {
    exercise_name: string;
    weight_kg: number;
    reps_done: number;
    rpe_felt: number;
  };
}

export interface TodayFoodLogsSummary {
  date: string; // YYYY-MM-DD
  count: number;
  kcal_total: number;
  macros_total: { p: number; c: number; f: number };
  kcal_target?: number; // from active_plan, copied for delta computation
  meals_sample: Array<{ name: string; kcal: number }>;
}

export interface RecentFormCheck {
  exercise_name: string;
  date: string; // YYYY-MM-DD or ISO
  feedback_short: string; // top correction phrase, 1-2 sentences
}

export interface StreakState {
  current: number;
  longest: number;
  last_checkin_date?: string;
}

export interface BodyScanRecent {
  date: string;
  bf_pct?: number;
  muscle_mass_kg?: number;
  diff_vs_previous?: {
    bf_pct_delta?: number;
    muscle_mass_kg_delta?: number;
    days_between?: number;
  };
}

export interface WearablesToday {
  date: string;
  steps?: number;
  active_calories_kcal?: number;
  hr_resting_bpm?: number;
  source?: string;
}

export interface SubscriptionContext {
  tier: 'free' | 'premium';
  current_period_end?: string;
}

// Wave 6B — persistent coach memory
export interface CoachStateContext {
  last_intervention_at?: string;
  has_unread_intervention?: boolean;
  topics_discussed?: string[];
  pending_followups?: Array<{ topic: string; due_at: string; done?: boolean }>;
  response_style?: 'short' | 'verbose' | 'data_driven' | 'mixed';
  welcome_sent?: boolean;
  plan_debrief_sent?: boolean;
  personality_notes?: string;
}

// ---------------------------------------------------------------------------

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
  // Wave 5A — enrichments
  last_session_summary?: LastSessionSummary;
  today_food_logs?: TodayFoodLogsSummary;
  recent_form_checks?: RecentFormCheck[];
  streak?: StreakState;
  body_scan_recent?: BodyScanRecent;
  wearables_today?: WearablesToday;
  subscription?: SubscriptionContext;
  // Wave 6B
  coach_state?: CoachStateContext;
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
${p?.shoulder_cm ? `- Tour d'épaules : ${p.shoulder_cm} cm` : ''}
${p?.chest_cm ? `- Tour de poitrine : ${p.chest_cm} cm` : ''}
${p?.arm_cm ? `- Tour de bras : ${p.arm_cm} cm` : ''}
${p?.forearm_cm ? `- Tour d'avant-bras : ${p.forearm_cm} cm` : ''}
${p?.wrist_cm ? `- Tour de poignet : ${p.wrist_cm} cm` : ''}
${p?.thigh_cm ? `- Tour de cuisse : ${p.thigh_cm} cm` : ''}
${p?.calf_cm ? `- Tour de mollet : ${p.calf_cm} cm` : ''}
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

  // Wave 9 follow-up — render sessions with explicit indices so the coach
  // can emit `<COACH_PLAN_PATCH>{"training.sessions.X.exercises.Y.name": "..."}`
  // with the right X / Y. Without this the coach has no way to address an
  // exo programmatically and falls back to free-text suggestions.
  const sessionsBlock =
    p.sessions && p.sessions.length > 0
      ? `\nSÉANCES ACTIVES (utilise ces indices EXACTS pour <COACH_PLAN_PATCH>) :\n` +
        p.sessions
          .map(
            (s, x) =>
              `- training.sessions.${x} → ${s.name} (${s.frequency_weekly}×/sem)\n` +
              s.exercises
                .map(
                  (e, y) =>
                    `    training.sessions.${x}.exercises.${y} → ${e.name} · ${e.sets}×${e.reps} · repos ${e.rest_seconds}s${e.superset_group ? ` · superset ${e.superset_group}` : ''}`,
                )
                .join('\n'),
          )
          .join('\n')
      : '';

  return `
PLAN NUTRITIONNEL ACTIF :
- Calories : ${p.kcal ?? '?'} kcal/jour
- Macros : ${p.macros?.p ?? '?'}g P / ${p.macros?.c ?? '?'}g C / ${p.macros?.f ?? '?'}g F
- Stratégie nutrition : ${p.strategy_nutrition ?? 'non précisée'}
- Stratégie training : ${p.strategy_training ?? 'non précisée'}${sessionsBlock}
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

// ---- Wave 5A block builders ---------------------------------------------

function lastSessionBlock(ctx: UserContext): string {
  const s = ctx.last_session_summary;
  if (!s) return '';
  const minutes = Math.round(s.duration_seconds / 60);
  const finishedDate = new Date(s.finished_at);
  const daysAgo = Math.floor((Date.now() - finishedDate.getTime()) / (24 * 3600 * 1000));
  const recency = daysAgo === 0 ? "aujourd'hui" : daysAgo === 1 ? "hier" : `il y a ${daysAgo}j`;
  const delta = s.vs_previous_volume_pct !== undefined
    ? ` (${s.vs_previous_volume_pct > 0 ? '+' : ''}${s.vs_previous_volume_pct}% volume vs précédente)`
    : '';
  const topLiftLine = s.top_lift
    ? `\n- Top lift : ${s.top_lift.exercise_name} ${s.top_lift.weight_kg}kg × ${s.top_lift.reps_done} reps @ RPE ${s.top_lift.rpe_felt}`
    : '';
  return `
[DERNIÈRE SÉANCE — ${recency}] · ${s.session_code} · "${s.operation_name}"
- Durée : ${minutes} min · Volume : ${s.volume_kg} kg · Complétion : ${s.completion_pct}%${delta}${topLiftLine}

Tu peux référencer cette séance pour féliciter, ajuster la prochaine, repérer une stagnation ou une régression. Si l'utilisateur te pose une question liée à la musculation et qu'il a fait sa séance récemment, ouvre par une phrase qui le montre.
`;
}

function todayFoodBlock(ctx: UserContext): string {
  const f = ctx.today_food_logs;
  if (!f) return '';
  const target = f.kcal_target;
  const delta = target ? f.kcal_total - target : undefined;
  const deltaStr = delta !== undefined
    ? `Reste à manger : ${Math.max(0, -delta)} kcal (cible ${target}, actuel ${f.kcal_total})`
    : `Total kcal : ${f.kcal_total}`;
  const meals = f.meals_sample.slice(0, 5).map((m) => `  - ${m.name} (${m.kcal} kcal)`).join('\n');
  return `
[ALIMENTATION JOUR EN COURS — ${f.date}] · ${f.count} repas loggués
${deltaStr}
Macros consommées : ${f.macros_total.p}g P / ${f.macros_total.c}g C / ${f.macros_total.f}g F
Repas du jour :
${meals || '  (aucun détail)'}

Tu peux conseiller des choix alimentaires précis pour le reste de la journée en fonction du delta restant.
`;
}

function recentFormChecksBlock(ctx: UserContext): string {
  const fc = ctx.recent_form_checks;
  if (!fc || fc.length === 0) return '';
  const lines = fc.slice(0, 3).map((c) => `- ${c.date} · ${c.exercise_name} : ${c.feedback_short}`).join('\n');
  return `
[ANALYSES VIDÉO TECHNIQUE RÉCENTES]
${lines}

Si la question utilisateur porte sur un de ces exos, rappelle la correction technique précédente.
`;
}

function streakBlock(ctx: UserContext): string {
  const s = ctx.streak;
  if (!s || (!s.current && !s.longest)) return '';
  return `
[STREAK D'ENGAGEMENT]
- Actuelle : ${s.current} jour(s) · Record : ${s.longest} jour(s)
${s.current === s.longest && s.current > 0 ? "L'utilisateur est sur son record perso — souligne-le si pertinent." : ''}
`;
}

function bodyScanBlock(ctx: UserContext): string {
  const b = ctx.body_scan_recent;
  if (!b) return '';
  const diff = b.diff_vs_previous;
  const diffStr = diff
    ? `\nDiff vs scan précédent (${diff.days_between ?? '?'}j) : ${diff.bf_pct_delta !== undefined ? `${diff.bf_pct_delta > 0 ? '+' : ''}${diff.bf_pct_delta}% BF` : ''} ${diff.muscle_mass_kg_delta !== undefined ? `${diff.muscle_mass_kg_delta > 0 ? '+' : ''}${diff.muscle_mass_kg_delta}kg muscle` : ''}`.trim()
    : '';
  return `
[SCAN CORPOREL RÉCENT — ${b.date}]
- BF : ${b.bf_pct !== undefined ? `${b.bf_pct}%` : 'N/A'} · Masse musculaire : ${b.muscle_mass_kg !== undefined ? `${b.muscle_mass_kg}kg` : 'N/A'}${diffStr}
`;
}

function wearablesBlock(ctx: UserContext): string {
  const w = ctx.wearables_today;
  if (!w) return '';
  const fields: string[] = [];
  if (w.steps !== undefined) fields.push(`Pas : ${w.steps}`);
  if (w.active_calories_kcal !== undefined) fields.push(`Cal actives : ${w.active_calories_kcal} kcal`);
  if (w.hr_resting_bpm !== undefined) fields.push(`FC repos : ${w.hr_resting_bpm} bpm`);
  if (fields.length === 0) return '';
  return `\n[WEARABLE JOUR EN COURS · ${w.source ?? 'inconnu'}] ${fields.join(' · ')}\n`;
}

function coachStateBlock(ctx: UserContext): string {
  const s = ctx.coach_state;
  if (!s) return '';
  const lastDate = s.last_intervention_at ? s.last_intervention_at.slice(0, 16).replace('T', ' ') : 'jamais';
  const topics = (s.topics_discussed ?? []).slice(-10).join(', ') || '(aucun)';
  const followups = (s.pending_followups ?? [])
    .filter((f) => !f.done)
    .slice(0, 5)
    .map((f) => `  - ${f.topic} (à reprendre vers ${f.due_at.slice(0, 10)})`)
    .join('\n');
  const styleHint =
    s.response_style === 'short'
      ? "L'utilisateur préfère des réponses courtes et directes. Évite les longs développements."
      : s.response_style === 'verbose'
        ? "L'utilisateur aime des explications détaillées et le contexte scientifique."
        : s.response_style === 'data_driven'
          ? "L'utilisateur valorise les chiffres et les références scientifiques précises."
          : "Style de réponse mixte — adapte selon la complexité de la question.";
  return `
[MÉMOIRE COACH — état persistant]
- Dernière intervention : ${lastDate}
- Sujets déjà abordés : ${topics}
- Style préféré : ${s.response_style ?? 'mixed'} — ${styleHint}
${followups ? `Followups en attente :\n${followups}` : ''}
${s.personality_notes ? `Notes perso : ${s.personality_notes}` : ''}

Ne ré-explique pas les sujets déjà couverts sauf si l'utilisateur le demande. Ouvre par référence à la dernière intervention si pertinent.
`;
}

function subscriptionBlock(ctx: UserContext): string {
  const s = ctx.subscription;
  if (!s) return '';
  if (s.tier === 'free') {
    return `\n[TIER : FREE] — Ne pousse pas l'upgrade sauf si l'utilisateur demande explicitement. Reste utile sur les fonctionnalités gratuites.\n`;
  }
  return `\n[TIER : PREMIUM] — L'utilisateur a accès à toutes les features (form-check vidéo, scan corporel, RAG scientifique étendu).\n`;
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
  // Wave 5A
  includeLastSession?: boolean;
  includeTodayFood?: boolean;
  includeFormChecks?: boolean;
  includeStreak?: boolean;
  includeBodyScan?: boolean;
  includeWearables?: boolean;
  includeSubscription?: boolean;
  includeCoachState?: boolean;
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
  includeLastSession: true,
  includeTodayFood: true,
  includeFormChecks: true,
  includeStreak: true,
  includeBodyScan: true,
  includeWearables: true,
  includeSubscription: true,
  includeCoachState: true,
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
  if (o.includeSubscription) parts.push(subscriptionBlock(ctx));
  if (o.includeCoachState) parts.push(coachStateBlock(ctx));
  if (o.includeProfilePath) parts.push(profilePathBlock(ctx));
  if (o.includeGlp1) parts.push(glp1Block(ctx));
  if (o.includeFasting) parts.push(fastingBlock(ctx));
  if (o.includeBloodwork) parts.push(bloodworkBlock(ctx));
  if (o.includeLastSession) parts.push(lastSessionBlock(ctx));
  if (o.includeTodayFood) parts.push(todayFoodBlock(ctx));
  if (o.includeFormChecks) parts.push(recentFormChecksBlock(ctx));
  if (o.includeStreak) parts.push(streakBlock(ctx));
  if (o.includeBodyScan) parts.push(bodyScanBlock(ctx));
  if (o.includeWearables) parts.push(wearablesBlock(ctx));
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
  // Wave 5A
  lastSessionSummary?: LastSessionSummary;
  todayFoodLogs?: TodayFoodLogsSummary;
  recentFormChecks?: RecentFormCheck[];
  streak?: StreakState;
  bodyScanRecent?: BodyScanRecent;
  wearablesToday?: WearablesToday;
  subscription?: SubscriptionContext;
  coachState?: CoachStateContext;
}

export function buildUserContext(input: BuildContextInput): UserContext {
  const u = input.userData ?? {};
  const ap = input.activePlan;

  // last_session_summary is denormalized onto users/{uid} by /api/sessions/finish.
  // We prefer the input override (caller may have refetched) but fall back on the doc.
  const lastSession =
    input.lastSessionSummary ?? (u.last_session_summary as LastSessionSummary | undefined);

  // Subscription tier defaults to 'free' if not set
  const sub = input.subscription ?? (u.subscription
    ? { tier: (u.subscription.tier ?? 'free') as 'free' | 'premium', current_period_end: u.subscription.current_period_end }
    : undefined);

  // Streak lives on users/{uid}.streak per Wave 2 design
  const streak = input.streak ?? (u.streak as StreakState | undefined);

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
          // Wave 9 follow-up — keep sessions with their original ordering
          // so the coach can address exos by index in <COACH_PLAN_PATCH>.
          sessions: Array.isArray(ap.training?.sessions)
            ? ap.training.sessions.map((s: Record<string, unknown>) => ({
                name: String(s.name ?? ''),
                frequency_weekly: Number(s.frequency_weekly ?? 0),
                exercises: Array.isArray(s.exercises)
                  ? (s.exercises as Array<Record<string, unknown>>).map((e) => ({
                      name: String(e.name ?? ''),
                      sets: Number(e.sets ?? 0),
                      reps: String(e.reps ?? ''),
                      rest_seconds: Number(e.rest_seconds ?? 0),
                      superset_group: e.superset_group as string | undefined,
                    }))
                  : [],
              }))
            : undefined,
        }
      : undefined,
    glp1: u.medical?.glp1 ?? undefined,
    fasting: u.fasting_protocol ?? undefined,
    bloodwork: input.bloodwork,
    rag_sources: input.ragSources,
    notification_context: input.notificationContext,
    last_session_summary: lastSession,
    today_food_logs: input.todayFoodLogs,
    recent_form_checks: input.recentFormChecks,
    streak,
    body_scan_recent: input.bodyScanRecent,
    wearables_today: input.wearablesToday,
    subscription: sub,
    coach_state: input.coachState,
  };
}
