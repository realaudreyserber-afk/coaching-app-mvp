import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ServiceStatus {
  configured: boolean;
  detail?: string;
}

function checkVar(name: string): ServiceStatus {
  const v = process.env[name];
  return {
    configured: typeof v === 'string' && v.length > 0 && !v.startsWith('mock-'),
  };
}

function checkAll(names: string[]): ServiceStatus {
  const missing = names.filter((n) => !checkVar(n).configured);
  return {
    configured: missing.length === 0,
    detail: missing.length > 0 ? `Missing: ${missing.join(', ')}` : undefined,
  };
}

export async function GET() {
  const checks: Record<string, ServiceStatus> = {
    firebase_client: checkAll([
      'NEXT_PUBLIC_FIREBASE_API_KEY',
      'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
      'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
      'NEXT_PUBLIC_FIREBASE_APP_ID',
    ]),
    firebase_admin: checkAll([
      'FIREBASE_ADMIN_PROJECT_ID',
      'FIREBASE_ADMIN_CLIENT_EMAIL',
      'FIREBASE_ADMIN_PRIVATE_KEY',
    ]),
    vertex_ai: {
      configured:
        Boolean(process.env.GEMINI_API_KEY) ||
        Boolean(
          process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY
        ),
      detail: process.env.GEMINI_API_KEY
        ? 'Using Gemini API key'
        : process.env.FIREBASE_ADMIN_PRIVATE_KEY
        ? 'Using GCP service account credentials'
        : 'Neither GEMINI_API_KEY nor service account configured',
    },
    stripe: checkAll([
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'STRIPE_PRICE_ID_MONTHLY',
      'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    ]),
    sentry: { configured: Boolean(process.env.SENTRY_DSN) },
    rag_fr: {
      configured: Boolean(process.env.CSE_API_KEY && process.env.CSE_FR_ENGINE_ID),
    },
    mock_auth: {
      configured: process.env.ENABLE_MOCK_AUTH === '1',
      detail:
        process.env.ENABLE_MOCK_AUTH === '1'
          ? '⚠️ Mock auth enabled — must be OFF in production'
          : 'disabled (production-safe)',
    },
  };

  const criticalOk = checks.firebase_client.configured && checks.firebase_admin.configured;
  const isProductionWithMockAuth =
    process.env.NODE_ENV === 'production' && process.env.ENABLE_MOCK_AUTH === '1';

  return NextResponse.json(
    {
      status: criticalOk && !isProductionWithMockAuth ? 'ok' : 'degraded',
      env: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
      region: process.env.VERCEL_REGION || 'unknown',
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'local',
      checks,
      warnings: isProductionWithMockAuth
        ? ['ENABLE_MOCK_AUTH=1 in production — anyone can authenticate as mock user']
        : [],
      timestamp: new Date().toISOString(),
    },
    { status: criticalOk && !isProductionWithMockAuth ? 200 : 503 }
  );
}
