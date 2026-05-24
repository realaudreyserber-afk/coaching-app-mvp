import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENV || process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1,
    beforeSend(event) {
      if (event.request?.headers) {
        const h = event.request.headers as Record<string, unknown>;
        delete h['authorization'];
        delete h['cookie'];
      }
      if (event.user) {
        const { id } = event.user;
        event.user = id ? { id } : undefined;
      }
      return event;
    },
  });
}
