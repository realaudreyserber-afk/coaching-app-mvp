import { NextRequest, NextResponse } from 'next/server';
import { withAuth, requireAdmin } from '@/lib/firebase/auth-middleware';
import { adminDb } from '@/lib/firebase/admin';

export async function GET(req: NextRequest) {
  return withAuth(req, async (authenticatedReq, user) => {
    try {
      const forbidden = await requireAdmin(authenticatedReq, user);
      if (forbidden) return forbidden;

      // 2. Fetch and aggregate metrics from Firestore
      const usersSnap = await adminDb.collection('users').get();
      const totalUsers = usersSnap.size;

      let completedProfiles = 0;
      let wearablesConnected = 0;
      let totalWeightStart = 0;
      let totalWeightCurrent = 0;
      let weightCounts = 0;
      let glp1Count = 0;
      let bariatricCount = 0;

      usersSnap.forEach(doc => {
        const data = doc.data();
        if (data.profile) {
          completedProfiles++;
          if (data.profile.wearables_connected) {
            wearablesConnected++;
          }
        }
        
        // Count specific cohort paths
        if (data.profile_path === 'glp1') glp1Count++;
        if (data.profile_path === 'post-bariatric') bariatricCount++;

        const startWeight = data.baseline?.weight_start;
        const currentWeight = data.profile?.weight;
        if (typeof startWeight === 'number' && typeof currentWeight === 'number') {
          totalWeightStart += startWeight;
          totalWeightCurrent += currentWeight;
          weightCounts++;
        }
      });

      // Calculate averages
      const averageWeightStart = weightCounts > 0 ? Math.round((totalWeightStart / weightCounts) * 10) / 10 : 0;
      const averageWeightCurrent = weightCounts > 0 ? Math.round((totalWeightCurrent / weightCounts) * 10) / 10 : 0;

      // Mock cohort retention KPI data since we don't have event logs in MVP database
      const dau = Math.max(1, Math.round(totalUsers * 0.4)); // 40% DAU estimate
      const wau = Math.max(1, Math.round(totalUsers * 0.7)); // 70% WAU estimate
      const mau = totalUsers;

      const funnel = {
        registered: totalUsers,
        onboardingCompleted: completedProfiles,
        firstCheckin: Math.round(completedProfiles * 0.85),
        weeklyActive: wau,
      };

      return NextResponse.json({
        success: true,
        metrics: {
          totalUsers,
          completedProfiles,
          wearablesConnected,
          averageWeightStart,
          averageWeightCurrent,
          glp1Count,
          bariatricCount,
          activeCohorts: {
            dau,
            wau,
            mau,
            ratio: totalUsers > 0 ? Math.round((dau / mau) * 100) : 0,
          },
          funnel,
        }
      }, { status: 200 });

    } catch (error) {
      console.error('Error in admin metrics API:', error);
      const errMsg = error instanceof Error ? error.message : String(error);
      return NextResponse.json(
        { error: 'Impossible de compiler les statistiques de cohorte.', details: errMsg },
        { status: 500 }
      );
    }
  });
}
