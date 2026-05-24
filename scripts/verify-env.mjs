#!/usr/bin/env node
/**
 * Verify that critical env vars are set before deploy.
 * Usage: node scripts/verify-env.mjs
 * Exits 1 if missing critical vars.
 */

const REQUIRED = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
  'FIREBASE_ADMIN_PROJECT_ID',
  'FIREBASE_ADMIN_CLIENT_EMAIL',
  'FIREBASE_ADMIN_PRIVATE_KEY',
];

const RECOMMENDED = [
  'GEMINI_API_KEY',
  'GOOGLE_CLOUD_PROJECT',
  'NEXT_PUBLIC_APP_URL',
  'ADMIN_EMAILS',
];

const FORBIDDEN_IN_PROD = ['ENABLE_MOCK_AUTH', 'NEXT_PUBLIC_ENABLE_MOCK_AUTH'];

const isProd =
  process.env.NODE_ENV === 'production' ||
  process.env.VERCEL_ENV === 'production';

let hasErrors = false;
let hasWarnings = false;

console.log('\n🔍 Verifying environment variables...\n');

for (const key of REQUIRED) {
  const v = process.env[key];
  const ok = typeof v === 'string' && v.length > 0 && !v.startsWith('mock-');
  console.log(`  ${ok ? '✅' : '❌'} ${key}${ok ? '' : ' (REQUIRED)'}`);
  if (!ok) hasErrors = true;
}

console.log('');
for (const key of RECOMMENDED) {
  const v = process.env[key];
  const ok = typeof v === 'string' && v.length > 0;
  console.log(`  ${ok ? '✅' : '⚠️ '} ${key}${ok ? '' : ' (recommended)'}`);
  if (!ok) hasWarnings = true;
}

if (isProd) {
  console.log('');
  for (const key of FORBIDDEN_IN_PROD) {
    const v = process.env[key];
    const set = typeof v === 'string' && v.length > 0;
    if (set) {
      console.error(`  🚨 ${key}=${v} — MUST BE UNSET IN PRODUCTION (security bypass)`);
      hasErrors = true;
    }
  }
}

console.log('');

if (hasErrors) {
  console.error('❌ Missing critical env vars. Cannot deploy.\n');
  process.exit(1);
}

if (hasWarnings) {
  console.warn('⚠️  Some recommended vars are missing — non-fatal but degraded mode.\n');
}

console.log('✅ Environment validated.\n');
process.exit(0);
