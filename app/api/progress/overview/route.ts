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

    // Séries historiques (pour les mini-graphiques sur les cartes).
    const series = await safe(
      (async () => {
        const ucol = adminDb.collection('users').doc(uid);
        const [hyd, slp, prsDocs, measDocs] = await Promise.all([
          ucol.collection('hydration_log').orderBy('date', 'desc').limit(14).get(),
          ucol.collection('sleep_log').orderBy('date', 'desc').limit(14).get(),
          ucol.collection('prs').limit(30).get(),
          ucol.collection('measurements').orderBy('date', 'desc').limit(40).get(),
        ]);
        const hydration = hyd.docs.map((d) => ({ date: d.id, ml: typeof d.data().total_ml === 'number' ? d.data().total_ml : 0 })).reverse();
        const sleep = slp.docs
          .map((d) => ({ date: d.id, hours: typeof d.data().sleep_hours === 'number' ? d.data().sleep_hours : null }))
          .filter((x) => x.hours !== null)
          .reverse();

        // Lift le plus lourd (mini-courbe carte) + les 3 gros (bench/squat/deadlift).
        const prsData = prsDocs.docs.map((d) => d.data());
        let topLift: { name: string; points: Array<{ date: string; e1rm: number }> } | null = null;
        let best: { name: string; cur: number; pts: Array<{ date: string; e1rm: number }> } | null = null;
        for (const x of prsData) {
          const entries = Array.isArray(x.prs) ? x.prs : [];
          if (entries.length && (!best || (x.current_1rm ?? 0) > best.cur)) {
            best = { name: x.exercise_name ?? x.exercise_id ?? 'Exercice', cur: x.current_1rm ?? 0, pts: entries.map((p: { date: string; estimated_1rm: number }) => ({ date: p.date, e1rm: p.estimated_1rm })).slice(-12) };
          }
        }
        if (best) topLift = { name: best.name, points: best.pts };

        const LIFT_RE: Record<string, { inc: RegExp; exc: RegExp }> = {
          squat: { inc: /squat/i, exc: /front|jump|split|pistol|hack|sissy|bulgar|goblet|overhead|saut/i },
          bench: { inc: /bench|d[ée]velopp[ée] couch/i, exc: /incline|inclin|decline|d[ée]clin|close|floor|sol|haltere|haltère/i },
          deadlift: { inc: /deadlift|soulev[ée] de terre/i, exc: /romanian|roumain|stiff|sumo|trap|deficit|d[ée]ficit|jambes tendues/i },
        };
        const lifts: Record<string, Array<{ date: string; e1rm: number }>> = {};
        for (const [key, { inc, exc }] of Object.entries(LIFT_RE)) {
          const cands = prsData.filter((x) => inc.test(x.exercise_name ?? '') && !exc.test(x.exercise_name ?? '') && Array.isArray(x.prs) && x.prs.length);
          if (cands.length) {
            const c = cands.sort((a, b) => b.prs.length - a.prs.length)[0];
            lifts[key] = c.prs.map((p: { date: string; estimated_1rm: number }) => ({ date: p.date, e1rm: p.estimated_1rm })).slice(-12);
          }
        }

        // Historique des mensurations par champ (chronologique).
        const measRows = measDocs.docs.map((d) => d.data()).reverse();
        const FIELDS = ['waist_cm', 'arm_cm', 'chest_cm', 'thigh_cm', 'hips_cm', 'neck_cm', 'shoulder_cm', 'calf_cm'];
        const measure: Record<string, Array<{ date: string; cm: number }>> = {};
        for (const f of FIELDS) {
          const pts = measRows.filter((r) => typeof r[f] === 'number').map((r) => ({ date: r.date as string, cm: r[f] as number }));
          if (pts.length >= 2) measure[f] = pts;
        }

        return { hydration, sleep, topLift, lifts, measure };
      })(),
    );

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
      forme, prs, sleep, hrv, hydration, habits, cravings, substances, measurements, cycle, subjective, series,
    });
  });
}
