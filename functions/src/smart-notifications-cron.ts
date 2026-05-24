/**
 * M19 — Smart notifications cron (hourly).
 *
 * Eligibility logic mirrors lib/features/notifications/templates.ts (Next side).
 * Duplicated here because Cloud Functions tsconfig is isolated from the
 * Next.js monorepo. Keep in sync manually when adding templates.
 *
 * Writes:
 *   - users/{uid}.notification_context (map snapshot of last decision)
 *   - users/{uid}/notification_log/{auto} (per-send audit)
 */
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { logger } from 'firebase-functions';
import { processInChunks } from './lib/parallel';

interface UserNotifContext {
  uid: string;
  fcm_token: string;
  has_checkin_today: boolean;
  has_micro_task_today_done: boolean;
  in_fasting_window: boolean;
  fasting_ends_in_minutes?: number;
  recent_plateau: boolean;
  streak_current?: number;
  streak_at_risk?: boolean;
  hour_local: number;
  weight_kg_lost_total?: number;
}

interface Template {
  id: string;
  category: string;
  eligible: (ctx: UserNotifContext) => boolean;
  build: (ctx: UserNotifContext) => { title: string; body: string; link: string };
}

const TEMPLATES: Template[] = [
  {
    id: 'checkin_evening_20h',
    category: 'checkin_reminder',
    eligible: (c) => !c.has_checkin_today && c.hour_local === 20,
    build: () => ({
      title: 'Ton check-in du jour',
      body: '30 secondes pour logger ton poids et ton ressenti.',
      link: '/checkin/daily',
    }),
  },
  {
    id: 'checkin_morning_8h',
    category: 'checkin_reminder',
    eligible: (c) => !c.has_checkin_today && c.hour_local === 8,
    build: () => ({
      title: 'Bonjour, prêt pour ton check-in ?',
      body: 'Démarre la journée en logant tes indicateurs.',
      link: '/checkin/daily',
    }),
  },
  {
    id: 'fasting_window_ending_soon',
    category: 'fasting_window',
    eligible: (c) =>
      c.in_fasting_window === false &&
      typeof c.fasting_ends_in_minutes === 'number' &&
      c.fasting_ends_in_minutes > 0 &&
      c.fasting_ends_in_minutes <= 30,
    build: (c) => ({
      title: 'Fin de jeûne dans ' + (c.fasting_ends_in_minutes ?? 0) + ' min',
      body: 'Prépare un repas riche en protéines pour rompre ton jeûne.',
      link: '/plan',
    }),
  },
  {
    id: 'streak_at_risk',
    category: 'streak_at_risk',
    eligible: (c) =>
      !!c.streak_at_risk && !c.has_checkin_today && (c.streak_current ?? 0) >= 7,
    build: (c) => ({
      title: `Tu vas perdre ta série de ${c.streak_current} jours`,
      body: '1 minute de check-in pour la préserver.',
      link: '/checkin/daily',
    }),
  },
  {
    id: 'plateau_detected',
    category: 'plateau_alert',
    eligible: (c) => c.recent_plateau && c.hour_local === 11,
    build: () => ({
      title: 'Plateau détecté sur 2 semaines',
      body: 'Ouvre ton bilan : on regarde ensemble ce qu\'on peut ajuster.',
      link: '/plan',
    }),
  },
  {
    id: 'micro_task_morning',
    category: 'micro_task',
    eligible: (c) => !c.has_micro_task_today_done && c.hour_local === 10,
    build: () => ({
      title: 'Ta micro-tâche du jour',
      body: 'Une action concrète, 30 secondes à valider.',
      link: '/dashboard',
    }),
  },
  {
    id: 'milestone_kg_lost',
    category: 'milestone',
    eligible: (c) =>
      typeof c.weight_kg_lost_total === 'number' &&
      c.weight_kg_lost_total > 0 &&
      Number.isInteger(c.weight_kg_lost_total) &&
      c.weight_kg_lost_total % 5 === 0,
    build: (c) => ({
      title: `${c.weight_kg_lost_total} kg perdus`,
      body: 'Pas une médaille, juste un fait. Continue.',
      link: '/progress',
    }),
  },
];

function pickTemplate(ctx: UserNotifContext): { template: Template; payload: { title: string; body: string; link: string } } | null {
  for (const t of TEMPLATES) {
    if (t.eligible(ctx)) {
      return { template: t, payload: t.build(ctx) };
    }
  }
  return null;
}

export const smartNotificationsCron = onSchedule(
  {
    schedule: 'every 1 hours',
    timeZone: 'Europe/Paris',
    region: 'europe-west1',
    memory: '512MiB',
  },
  async () => {
    const db = getFirestore();
    const messaging = getMessaging();
    const usersSnap = await db.collection('users').get();
    const todayStr = new Date().toISOString().split('T')[0];
    const hour_local = new Date().getHours();

    const results = await processInChunks(usersSnap.docs, 25, async (userDoc) => {
      try {
        const data = userDoc.data();
        if (data.settings?.notifications === false) return false;
        const fcm_token = data.fcm_token;
        if (!fcm_token) return false;
        const optOutCategories: string[] = data.settings?.notification_opt_out ?? [];

        // Build context from user state
        const checkinSnap = await db
          .collection('users').doc(userDoc.id)
          .collection('checkins_daily').doc(todayStr).get();

        const taskSnap = await db
          .collection('users').doc(userDoc.id)
          .collection('daily_tasks').doc(todayStr).get();

        const streakSnap = await db
          .collection('users').doc(userDoc.id)
          .collection('streak').doc('current').get();

        const baselineWeight = data.baseline?.weight;
        const currentWeight = checkinSnap.exists ? checkinSnap.data()?.weight : data.profile?.weight;
        const weight_kg_lost_total =
          typeof baselineWeight === 'number' && typeof currentWeight === 'number'
            ? Math.floor(baselineWeight - currentWeight)
            : undefined;

        const ctx: UserNotifContext = {
          uid: userDoc.id,
          fcm_token,
          has_checkin_today: checkinSnap.exists,
          has_micro_task_today_done: taskSnap.exists && taskSnap.data()?.completed === true,
          in_fasting_window: data.fasting_protocol?.active === true,
          recent_plateau: data.analytics?.plateau_detected === true,
          streak_current: streakSnap.exists ? streakSnap.data()?.value : undefined,
          streak_at_risk: streakSnap.exists ? streakSnap.data()?.at_risk === true : false,
          hour_local,
          weight_kg_lost_total,
        };

        const pick = pickTemplate(ctx);

        // Persist context snapshot (used by context-builder for personalized prompts)
        await db.collection('users').doc(userDoc.id).update({
          notification_context: {
            has_checkin_today: ctx.has_checkin_today,
            in_fasting_window: ctx.in_fasting_window,
            recent_plateau: ctx.recent_plateau,
            last_evaluated_at: new Date().toISOString(),
            last_template_picked: pick?.template.id ?? null,
          },
        });

        if (!pick) return false;

        // Granular opt-out per category (M19 UI)
        if (optOutCategories.includes(pick.template.category)) {
          logger.info(`Skipped ${pick.template.id} for ${userDoc.id}: category opted-out`);
          return false;
        }

        await messaging.send({
          token: fcm_token,
          notification: { title: pick.payload.title, body: pick.payload.body },
          webpush: { fcmOptions: { link: pick.payload.link } },
        });

        // Audit log
        await db.collection('users').doc(userDoc.id).collection('notification_log').add({
          template_id: pick.template.id,
          category: pick.template.category,
          sent_at: new Date().toISOString(),
        });

        return true;
      } catch (err) {
        logger.error(`Smart notif failed for ${userDoc.id}:`, err);
        return false;
      }
    });

    const notified = results.filter(Boolean).length;
    logger.info(`Smart notifications sent: ${notified}/${usersSnap.size} users`);
  }
);
