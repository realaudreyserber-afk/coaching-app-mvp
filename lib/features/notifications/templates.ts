/**
 * Notification template registry — used by M19 smart-notifs Cloud Function
 * and by /api/notifications/send-smart route.
 *
 * Each template has:
 *   - `id` : stable key for analytics + opt-out per category
 *   - `category` : group for opt-out granularity
 *   - `eligible(ctx)` : returns true if this template should fire right now
 *   - `build(ctx)` : returns the FCM notification payload (title + body + link)
 *
 * Generator (M19) iterates templates, picks the first eligible one, and either
 * sends the static payload or asks Gemini Flash to humanize it (cf.
 * lib/features/smart-notifs/generator.ts).
 */

export type NotifCategory =
  | 'checkin_reminder'
  | 'fasting_window'
  | 'micro_task'
  | 'plateau_alert'
  | 'milestone'
  | 'streak_at_risk';

export interface NotifContext {
  uid: string;
  has_checkin_today: boolean;
  has_micro_task_today_done: boolean;
  in_fasting_window: boolean;
  fasting_ends_in_minutes?: number;
  recent_plateau: boolean;
  streak_current?: number;
  streak_at_risk?: boolean;
  hour_local: number; // 0-23
  weight_kg_lost_total?: number;
  weight_kg_target_remaining?: number;
}

export interface NotifPayload {
  title: string;
  body: string;
  link: string;
  category: NotifCategory;
  template_id: string;
}

export interface NotifTemplate {
  id: string;
  category: NotifCategory;
  eligible: (ctx: NotifContext) => boolean;
  build: (ctx: NotifContext) => Omit<NotifPayload, 'category' | 'template_id'>;
}

export const NOTIF_TEMPLATES: NotifTemplate[] = [
  {
    id: 'checkin_evening_20h',
    category: 'checkin_reminder',
    eligible: (ctx) => !ctx.has_checkin_today && ctx.hour_local === 20,
    build: () => ({
      title: 'Ton check-in du jour',
      body: '30 secondes pour logger ton poids et ton ressenti.',
      link: '/checkin/daily',
    }),
  },
  {
    id: 'checkin_morning_8h',
    category: 'checkin_reminder',
    eligible: (ctx) => !ctx.has_checkin_today && ctx.hour_local === 8,
    build: () => ({
      title: 'Bonjour, prêt pour ton check-in ?',
      body: 'Démarre la journée en logant tes indicateurs.',
      link: '/checkin/daily',
    }),
  },
  {
    id: 'fasting_window_ending_soon',
    category: 'fasting_window',
    eligible: (ctx) =>
      ctx.in_fasting_window === false &&
      typeof ctx.fasting_ends_in_minutes === 'number' &&
      ctx.fasting_ends_in_minutes > 0 &&
      ctx.fasting_ends_in_minutes <= 30,
    build: (ctx) => ({
      title: 'Fin de jeûne dans ' + (ctx.fasting_ends_in_minutes ?? 0) + ' min',
      body: 'Prépare un repas riche en protéines pour rompre ton jeûne.',
      link: '/plan',
    }),
  },
  {
    id: 'streak_at_risk',
    category: 'streak_at_risk',
    eligible: (ctx) => !!ctx.streak_at_risk && !ctx.has_checkin_today && (ctx.streak_current ?? 0) >= 7,
    build: (ctx) => ({
      title: `Tu vas perdre ta série de ${ctx.streak_current} jours`,
      body: '1 minute de check-in pour la préserver.',
      link: '/checkin/daily',
    }),
  },
  {
    id: 'plateau_detected',
    category: 'plateau_alert',
    eligible: (ctx) => ctx.recent_plateau && ctx.hour_local === 11,
    build: () => ({
      title: 'Plateau détecté sur 2 semaines',
      body: 'Ouvre ton bilan : on regarde ensemble ce qu\'on peut ajuster.',
      link: '/plan',
    }),
  },
  {
    id: 'micro_task_morning',
    category: 'micro_task',
    eligible: (ctx) => !ctx.has_micro_task_today_done && ctx.hour_local === 10,
    build: () => ({
      title: 'Ta micro-tâche du jour',
      body: 'Une action concrète, 30 secondes à valider.',
      link: '/dashboard',
    }),
  },
  {
    id: 'milestone_kg_lost',
    category: 'milestone',
    eligible: (ctx) =>
      typeof ctx.weight_kg_lost_total === 'number' &&
      ctx.weight_kg_lost_total > 0 &&
      Number.isInteger(ctx.weight_kg_lost_total) &&
      ctx.weight_kg_lost_total % 5 === 0,
    build: (ctx) => ({
      title: `${ctx.weight_kg_lost_total} kg perdus`,
      body: 'Pas une médaille, juste un fait. Continue.',
      link: '/progress',
    }),
  },
];

export function pickEligibleTemplate(ctx: NotifContext): NotifPayload | null {
  for (const tpl of NOTIF_TEMPLATES) {
    if (!tpl.eligible(ctx)) continue;
    const built = tpl.build(ctx);
    return { ...built, category: tpl.category, template_id: tpl.id };
  }
  return null;
}
