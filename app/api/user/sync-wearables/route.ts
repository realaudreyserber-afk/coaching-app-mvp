import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/firebase/auth-middleware';
import { checkRateLimit } from '@/lib/firebase/rate-limit';
import { adminDb } from '@/lib/firebase/admin';
import { refreshGoogleFitAccessToken } from '@/lib/features/wearables/oauth';
import { fetchGoogleFitMetrics } from '@/lib/features/wearables/sync-service';
import { flags } from '@/lib/features/flags';

export async function POST(req: NextRequest) {
  if (!flags.wearables()) {
    return NextResponse.json(
      { error: "Ce module n'est pas actif." },
      { status: 403 }
    );
  }

  return withAuth(req, async (authenticatedReq, user) => {
    const uid = user.uid;
    // Wave 13C — Cap Google Fit calls (OAuth refresh + 3-4 API calls each).
    const rl = await checkRateLimit(uid, { scope: 'wearables_sync', perHour: 12 });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'rate_limited', retry_after_sec: rl.retryAfterSec },
        { status: 429 },
      );
    }
    const todayStr = new Date().toISOString().split('T')[0];

    try {
      // 1. Fetch OAuth tokens
      const tokenRef = adminDb.collection('users').doc(uid).collection('tokens').doc('google-fit');
      const tokenSnap = await tokenRef.get();

      if (!tokenSnap.exists) {
        return NextResponse.json(
          { error: "Compte Google Fit non connecté." },
          { status: 400 }
        );
      }

      // ADR-006 snake_case migration : we read both snake_case (new) and
      // camelCase (legacy) for backward compat with existing token docs;
      // we write back only snake_case.
      const tokenData = tokenSnap.data() || {};
      let accessToken = tokenData.access_token ?? tokenData.accessToken;
      const refreshToken = tokenData.refresh_token ?? tokenData.refreshToken;
      let expiresAt = tokenData.expires_at ?? tokenData.expiresAt;

      if (!accessToken || !refreshToken) {
        return NextResponse.json(
          { error: "Identifiants OAuth invalides." },
          { status: 400 }
        );
      }

      // 2. Check token expiration (refresh if needed)
      // H4 fix : undefined expires_at (legacy doc missing the field) silently
      // skipped refresh + returned 401 from Google. Force refresh on missing.
      if (!expiresAt || typeof expiresAt !== 'number' || expiresAt <= Date.now() + 60000) {
        console.log(`Refreshing Google Fit token for user ${uid}...`);
        const refreshed = await refreshGoogleFitAccessToken(refreshToken);
        accessToken = refreshed.accessToken;
        expiresAt = refreshed.expiresAt;

        // Save refreshed tokens — snake_case canonical, explicitly delete
        // the legacy camelCase keys so we don't keep duplicates around (M2).
        const { FieldValue } = await import('firebase-admin/firestore');
        await tokenRef.set(
          {
            access_token: accessToken,
            expires_at: expiresAt,
            refresh_token: refreshToken,
            updated_at: new Date().toISOString(),
            accessToken: FieldValue.delete(),
            refreshToken: FieldValue.delete(),
            expiresAt: FieldValue.delete(),
            updatedAt: FieldValue.delete(),
          },
          { merge: true },
        );
      }

      // 3. Fetch Google Fit metrics for today
      const metrics = await fetchGoogleFitMetrics(accessToken, new Date());

      // 4. Save synced metrics — snake_case (ADR-006). The reader
      // lib/vertex/context-fetcher.ts already supports both shapes.
      await adminDb
        .collection('users')
        .doc(uid)
        .collection('wearable_sync')
        .doc(todayStr)
        .set({
          steps: metrics.steps,
          active_calories_kcal: metrics.caloriesBurned,
          source: 'google_fit',
          synced_at: new Date().toISOString(),
        });

      return NextResponse.json({
        success: true,
        metrics,
      }, { status: 200 });

    } catch (error) {
      console.error('Error syncing Google Fit metrics:', error);
      const errMsg = error instanceof Error ? error.message : String(error);
      return NextResponse.json(
        { error: 'Impossible de synchroniser avec Google Fit.', details: errMsg },
        { status: 500 }
      );
    }
  });
}
