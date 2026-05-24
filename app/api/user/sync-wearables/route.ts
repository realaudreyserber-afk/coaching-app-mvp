import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/firebase/auth-middleware';
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

      const tokenData = tokenSnap.data() || {};
      let accessToken = tokenData.accessToken;
      const refreshToken = tokenData.refreshToken;
      let expiresAt = tokenData.expiresAt;

      if (!accessToken || !refreshToken) {
        return NextResponse.json(
          { error: "Identifiants OAuth invalides." },
          { status: 400 }
        );
      }

      // 2. Check token expiration (refresh if needed)
      if (expiresAt <= Date.now() + 60000) { // Refresh if expiring in less than 1 minute
        console.log(`Refreshing Google Fit token for user ${uid}...`);
        const refreshed = await refreshGoogleFitAccessToken(refreshToken);
        accessToken = refreshed.accessToken;
        expiresAt = refreshed.expiresAt;

        // Save refreshed tokens
        await tokenRef.update({
          accessToken,
          expiresAt,
          updatedAt: new Date().toISOString(),
        });
      }

      // 3. Fetch Google Fit metrics for today
      const metrics = await fetchGoogleFitMetrics(accessToken, new Date());

      // 4. Save synced metrics in Firestore wearable_sync subcollection
      await adminDb
        .collection('users')
        .doc(uid)
        .collection('wearable_sync')
        .doc(todayStr)
        .set({
          steps: metrics.steps,
          caloriesBurned: metrics.caloriesBurned,
          syncedAt: new Date().toISOString(),
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
