/**
 * Optional Sentry init for Cloud Functions Gen 2.
 * Activate by setting SENTRY_DSN secret.
 * Import at the top of each function entrypoint that needs error capture.
 */
import { logger } from 'firebase-functions';

let initialized = false;

export async function initSentry(): Promise<void> {
  if (initialized) return;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  try {
    const Sentry = await import('@sentry/node');
    Sentry.init({
      dsn,
      environment: process.env.SENTRY_ENV || 'production',
      tracesSampleRate: 0.1,
      beforeSend(event) {
        if (event.user) {
          const { id } = event.user;
          event.user = id ? { id } : undefined;
        }
        return event;
      },
    });
    initialized = true;
  } catch (err) {
    logger.warn('Sentry init failed (package not installed?):', err);
  }
}

export async function captureException(err: unknown, context?: Record<string, unknown>): Promise<void> {
  if (!initialized) return;
  try {
    const Sentry = await import('@sentry/node');
    Sentry.withScope((scope) => {
      if (context) {
        for (const [k, v] of Object.entries(context)) scope.setExtra(k, v);
      }
      Sentry.captureException(err);
    });
  } catch {
    // ignore
  }
}
