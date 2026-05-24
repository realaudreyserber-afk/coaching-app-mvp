export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export async function onRequestError(...args: unknown[]) {
  if (!process.env.SENTRY_DSN) return;
  try {
    const Sentry = await import('@sentry/nextjs');
    const fn = (Sentry as unknown as { captureRequestError?: (...a: unknown[]) => void }).captureRequestError;
    if (typeof fn === 'function') fn(...args);
  } catch {
    // sentry not loaded
  }
}
