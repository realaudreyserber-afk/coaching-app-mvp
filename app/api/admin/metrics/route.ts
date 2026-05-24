import { NextRequest, NextResponse } from 'next/server';
import { withAuth, requireAdmin } from '@/lib/firebase/auth-middleware';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

interface Counters {
  total_users: number;
  completed_profiles: number;
  wearables_connected: number;
  glp1_active: number;
  post_bariatric: number;
  high_bf: number;
  ex_athlete: number;
  standard_path: number;
  premium_active: number;
  fasting_active: number;
}

interface WeightAgg {
  count: number;
  total_start: number;
  total_current: number;
  total_delta: number;
}

function todayUtcStr(): string {
  return new Date().toISOString().split('T')[0];
}

function daysAgoStr(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().split('T')[0];
}

export async function GET(req: NextRequest) {
  return withAuth(req, async (authReq, user) => {
    const forbidden = await requireAdmin(authReq, user);
    if (forbidden) return forbidden;

    try {
      const usersSnap = await adminDb.collection('users').get();
      const counters: Counters = {
        total_users: usersSnap.size,
        completed_profiles: 0,
        wearables_connected: 0,
        glp1_active: 0,
        post_bariatric: 0,
        high_bf: 0,
        ex_athlete: 0,
        standard_path: 0,
        premium_active: 0,
        fasting_active: 0,
      };

      const weight: WeightAgg = { count: 0, total_start: 0, total_current: 0, total_delta: 0 };

      const today = todayUtcStr();
      const since7 = daysAgoStr(7);
      const since30 = daysAgoStr(30);

      // Cohort by signup month
      const cohorts: Record<string, { signups: number; active_30d: number }> = {};

      // Activity queries are run in parallel per user (chunked) — cheap reads
      const activeDaily = new Set<string>();
      const active7d = new Set<string>();
      const active30d = new Set<string>();

      // First pass: profile-level counters + cohort assignment
      const uids: string[] = [];
      usersSnap.forEach((d) => {
        const data = d.data();
        uids.push(d.id);

        if (data.profile) counters.completed_profiles++;
        if (data.profile?.wearables_connected) counters.wearables_connected++;
        if (data.medical?.glp1?.active) counters.glp1_active++;
        if (data.profile_path === 'post-bariatric') counters.post_bariatric++;
        if (data.profile_path === 'high-bf') counters.high_bf++;
        if (data.profile_path === 'ex-athlete') counters.ex_athlete++;
        if (data.profile_path === 'standard' || !data.profile_path) counters.standard_path++;
        if (data.subscription?.tier === 'premium' || data.subscription?.tier === 'premium_plus') {
          counters.premium_active++;
        }
        if (data.fasting_protocol?.active) counters.fasting_active++;

        const startWeight = data.baseline?.weight_start ?? data.baseline?.weight;
        const currentWeight = data.profile?.weight ?? data.analytics?.weight_avg_7d;
        if (typeof startWeight === 'number' && typeof currentWeight === 'number') {
          weight.count++;
          weight.total_start += startWeight;
          weight.total_current += currentWeight;
          weight.total_delta += currentWeight - startWeight;
        }

        const createdAt: string | undefined = data.profile?.created_at;
        if (createdAt) {
          const month = createdAt.slice(0, 7); // YYYY-MM
          if (!cohorts[month]) cohorts[month] = { signups: 0, active_30d: 0 };
          cohorts[month].signups++;
        }
      });

      // Second pass: parallel activity probes
      const CHUNK = 25;
      for (let i = 0; i < uids.length; i += CHUNK) {
        const slice = uids.slice(i, i + CHUNK);
        await Promise.all(
          slice.map(async (uid) => {
            try {
              const recentSnap = await adminDb
                .collection('users').doc(uid)
                .collection('checkins_daily')
                .where('date', '>=', since30)
                .limit(50)
                .get();
              if (recentSnap.empty) return;

              active30d.add(uid);
              for (const d of recentSnap.docs) {
                const dateStr = d.data().date as string | undefined;
                if (!dateStr) continue;
                if (dateStr === today) activeDaily.add(uid);
                if (dateStr >= since7) active7d.add(uid);
              }

              // Update cohort 30d retention
              const userDoc = await adminDb.collection('users').doc(uid).get();
              const createdAt = userDoc.data()?.profile?.created_at as string | undefined;
              if (createdAt) {
                const month = createdAt.slice(0, 7);
                if (cohorts[month]) cohorts[month].active_30d++;
              }
            } catch (err) {
              console.warn(`Activity probe failed for ${uid}:`, err);
            }
          })
        );
      }

      const dau = activeDaily.size;
      const wau = active7d.size;
      const mau = active30d.size;

      const avg = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 10) / 10 : 0);

      return NextResponse.json({
        success: true,
        as_of: new Date().toISOString(),
        counters,
        funnel: {
          registered: counters.total_users,
          onboarding_completed: counters.completed_profiles,
          weekly_active: wau,
          monthly_active: mau,
          premium_active: counters.premium_active,
        },
        weight_aggregate: {
          users_with_data: weight.count,
          avg_start_kg: avg(weight.total_start, weight.count),
          avg_current_kg: avg(weight.total_current, weight.count),
          avg_delta_kg: avg(weight.total_delta, weight.count),
        },
        profile_path_breakdown: {
          standard: counters.standard_path,
          high_bf: counters.high_bf,
          glp1: counters.glp1_active,
          post_bariatric: counters.post_bariatric,
          ex_athlete: counters.ex_athlete,
        },
        active_cohorts: {
          dau,
          wau,
          mau,
          stickiness_pct: mau > 0 ? Math.round((dau / mau) * 100) : 0,
        },
        cohort_retention_by_month: Object.entries(cohorts)
          .sort(([a], [b]) => b.localeCompare(a))
          .slice(0, 12)
          .map(([month, c]) => ({
            month,
            signups: c.signups,
            active_30d: c.active_30d,
            retention_pct: c.signups > 0 ? Math.round((c.active_30d / c.signups) * 100) : 0,
          })),
      });
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
