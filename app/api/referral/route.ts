/**
 * /api/referral — Parrainage côté serveur (admin SDK).
 *
 * Audit 2026-05-28 #2 : la logique vivait côté client (referral-service.ts +
 * transaction inline dans /settings/referral). Problèmes :
 *  - self-grant : le client s'auto-créditait `premium_credits+1` ;
 *  - fuite PII : énumération de codes renvoyait `profile.name` d'autrui ;
 *  - write parrain bloqué par les nouvelles rules (owner-only) → état incohérent.
 *
 * Désormais tout passe ici (admin SDK bypasse les rules, rate-limit + auth).
 *
 *  GET  → garantit un code unique pour l'appelant + renvoie ses stats.
 *  POST → applique un code de parrain (body { code }). +1 mois aux deux.
 *
 * Champs Firestore snake_case (ADR-006) :
 *   users/{uid}.referral = { code, referred_by?, referred_users[], premium_credits, updated_at }
 */
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { withAuth } from '@/lib/firebase/auth-middleware';
import { checkRateLimit } from '@/lib/firebase/rate-limit';
import { generateReferralCode } from '@/lib/features/referral/code';

export const runtime = 'nodejs';

interface ReferralField {
  code?: string;
  referred_by?: string;
  referred_users?: string[];
  premium_credits?: number;
}

export async function GET(req: NextRequest) {
  return withAuth(req, async (_authReq, user) => {
    const uid = user.uid;
    const userRef = adminDb.collection('users').doc(uid);

    try {
      const snap = await userRef.get();
      const ref = (snap.data()?.referral as ReferralField | undefined) ?? {};

      if (ref.code) {
        return NextResponse.json({
          code: ref.code,
          referred_count: ref.referred_users?.length ?? 0,
          premium_credits: ref.premium_credits ?? 0,
          referred_by: ref.referred_by ?? null,
        });
      }

      // Génère un code unique (best-effort anti-collision sur quelques essais).
      for (let attempt = 0; attempt < 6; attempt++) {
        const candidate = generateReferralCode();
        const collision = await adminDb
          .collection('users')
          .where('referral.code', '==', candidate)
          .limit(1)
          .get();
        if (collision.empty) {
          const now = new Date().toISOString();
          await userRef.set(
            {
              referral: {
                code: candidate,
                referred_users: [],
                premium_credits: 0,
                updated_at: now,
              },
            },
            { merge: true },
          );
          return NextResponse.json({
            code: candidate,
            referred_count: 0,
            premium_credits: 0,
            referred_by: null,
          });
        }
      }
      return NextResponse.json(
        { error: 'Impossible de générer un code unique. Réessaye.' },
        { status: 503 },
      );
    } catch (err) {
      console.error('[api/referral GET] failed:', err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'referral_failed' },
        { status: 500 },
      );
    }
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (_authReq, user) => {
    const uid = user.uid;

    const rl = await checkRateLimit(uid, { scope: 'referral_apply', perHour: 10 });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Trop de tentatives. Réessaye plus tard.', retry_after_sec: rl.retryAfterSec },
        { status: 429 },
      );
    }

    let body: { code?: string };
    try {
      body = (await req.json()) as { code?: string };
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
    }

    const normalized = (body.code ?? '').toUpperCase().trim();
    if (!normalized || normalized.length < 4) {
      return NextResponse.json({ error: 'Code de parrainage invalide.' }, { status: 400 });
    }

    try {
      const matches = await adminDb
        .collection('users')
        .where('referral.code', '==', normalized)
        .limit(1)
        .get();
      if (matches.empty) {
        return NextResponse.json({ error: 'Code de parrainage invalide.' }, { status: 404 });
      }

      const referrerDoc = matches.docs[0];
      const referrerUid = referrerDoc.id;
      if (referrerUid === uid) {
        return NextResponse.json(
          { error: 'Tu ne peux pas parrainer ton propre compte.' },
          { status: 400 },
        );
      }

      const userRef = adminDb.collection('users').doc(uid);
      const referrerRef = referrerDoc.ref;

      const result = await adminDb.runTransaction(async (tx) => {
        const [freshUser, freshReferrer] = await Promise.all([
          tx.get(userRef),
          tx.get(referrerRef),
        ]);
        const uData = (freshUser.data()?.referral as ReferralField | undefined) ?? {};
        const rData = (freshReferrer.data()?.referral as ReferralField | undefined) ?? {};

        if (uData.referred_by) {
          throw new Error('already_referred');
        }

        const now = new Date().toISOString();
        tx.set(
          userRef,
          {
            referral: {
              referred_by: referrerUid,
              premium_credits: (uData.premium_credits ?? 0) + 1,
              updated_at: now,
            },
          },
          { merge: true },
        );
        tx.set(
          referrerRef,
          {
            referral: {
              referred_users: [...(rData.referred_users ?? []), uid],
              premium_credits: (rData.premium_credits ?? 0) + 1,
              updated_at: now,
            },
          },
          { merge: true },
        );

        const referrerName =
          (freshReferrer.data()?.profile?.name as string | undefined) ?? 'Abonné';
        return { referrer_name: referrerName };
      });

      return NextResponse.json({ success: true, referrer_name: result.referrer_name });
    } catch (err) {
      if (err instanceof Error && err.message === 'already_referred') {
        return NextResponse.json(
          { error: 'Tu as déjà été parrainé par un autre utilisateur.' },
          { status: 409 },
        );
      }
      console.error('[api/referral POST] failed:', err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'referral_failed' },
        { status: 500 },
      );
    }
  });
}
