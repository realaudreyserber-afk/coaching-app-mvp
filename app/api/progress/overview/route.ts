/**
 * /api/progress/overview — agrège les snapshots de suivi (lecture seule) pour la
 * page Suivi (onglet Bilan). Réutilise les MÊMES fonctions snapshot que les agents
 * (DRY). Dégradation gracieuse : un snapshot qui échoue => null, le reste passe.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/firebase/auth-middleware';
import { adminDb } from '@/lib/firebase/admin';
import { getPrsSnapshot } from '@/lib/features/personal-records/store';
import { getSleepSnapshot } from '@/lib/features/sleep/store';
import { getHrvSnapshot } from '@/lib/features/hrv/store';
import { getHydrationSnapshot } from '@/lib/features/hydration/store';
import { getHabitsSnapshot } from '@/lib/features/habits/store';
import { getCravingsSnapshot } from '@/lib/features/cravings/store';
import { getSubstancesSnapshot } from '@/lib/features/substances/store';
import { getMeasurementsSnapshot } from '@/lib/features/measurements/store';
import { getCycleSnapshot } from '@/lib/features/cycle/store';
import { computeForme } from '@/lib/features/progress/forme';

export const dynamic = 'force-dynamic';

async function safe<T>(p: Promise<T>): Promise<T | null> {
  try { return await p; } catch { return null; }
}

export async function GET(req: NextRequest) {
  return withAuth(req, async (_authReq, user) => {
    const uid = user.uid;

    let isFemale = false;
    try {
      const u = await adminDb.collection('users').doc(uid).get();
      isFemale = u.data()?.profile?.sex === 'female';
    } catch { /* */ }

    // Tendance ressenti (énergie/humeur/faim/sommeil) sur ~21 derniers check-ins.
    const subjective = await safe(
      (async () => {
        const snap = await adminDb
          .collection('users').doc(uid).collection('checkins_daily')
          .orderBy('created_at', 'desc').limit(21).get();
        const rows = snap.docs
          .map((d) => {
            const x = d.data();
            return {
              date: d.id,
              energy: typeof x.energy === 'number' ? x.energy : null,
              mood: typeof x.mood === 'number' ? x.mood : null,
              hunger: typeof x.hunger === 'number' ? x.hunger : null,
              sleep_hours: typeof x.sleep_hours === 'number' ? x.sleep_hours : null,
            };
          })
          .filter((r) => r.energy !== null || r.mood !== null || r.hunger !== null || r.sleep_hours !== null);
        return rows.reverse(); // ordre chronologique
      })(),
    );

    const [prs, sleep, hrv, hydration, habits, cravings, substances, measurements, cycle] =
      await Promise.all([
        safe(getPrsSnapshot(uid)),
        safe(getSleepSnapshot(uid)),
        safe(getHrvSnapshot(uid)),
        safe(getHydrationSnapshot(uid)),
        safe(getHabitsSnapshot(uid)),
        safe(getCravingsSnapshot(uid)),
        safe(getSubstancesSnapshot(uid)),
        safe(getMeasurementsSnapshot(uid)),
        isFemale ? safe(getCycleSnapshot(uid)) : Promise.resolve(null),
      ]);

    // Score "Forme du jour" (readiness) — synthèse des signaux dispo.
    const recentEnergy = (subjective ?? [])
      .map((s) => s.energy)
      .filter((e): e is number => typeof e === 'number')
      .slice(-7);
    const energyAvg = recentEnergy.length
      ? recentEnergy.reduce((a, b) => a + b, 0) / recentEnergy.length
      : null;
    const forme = computeForme({ sleep, hrv, hydration, energyAvg });

    return NextResponse.json({
      forme, prs, sleep, hrv, hydration, habits, cravings, substances, measurements, cycle, subjective,
    });
  });
}
