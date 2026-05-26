/**
 * POST /api/coach/apply-patch
 *
 * Body: { patch: PatchEntry[] | Record<string, PatchValue>; reason?: string }
 *
 * Applies a coach-generated patch to the user's ACTIVE plan in a transaction.
 * Steps:
 *   1. Parse + whitelist + range-validate via lib/features/coach-patches/plan-patch
 *   2. Read active plan
 *   3. Snapshot it into users/{uid}/plans_history/{ISO_ts}
 *   4. Apply patch via deep-set
 *   5. Write back to users/{uid}/plans/{planId}
 *   6. Audit log into users/{uid}/coach_patches/{ulid}
 *
 * Called from the front-end's <COACH_PLAN_PATCH> parser, similarly to how
 * <COACH_SAVE> calls /api/profile/update-fields.
 */
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { withAuth } from '@/lib/firebase/auth-middleware';
import { checkRateLimit } from '@/lib/firebase/rate-limit';
import {
  validatePatch,
  applyPatchToPlan,
  parsePatchPayload,
  type PatchEntry,
} from '@/lib/features/coach-patches/plan-patch';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  return withAuth(req, async (_authReq, user) => {
    const uid = user.uid;

    const rl = await checkRateLimit(uid, {
      scope: 'coach_apply_patch',
      perMinute: 10,
      perHour: 60,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'rate_limited', retry_after_sec: rl.retryAfterSec },
        { status: 429 },
      );
    }

    let body: { patch?: unknown; reason?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    if (body?.patch === undefined) {
      return NextResponse.json({ error: 'patch required' }, { status: 400 });
    }

    let entries: PatchEntry[];
    try {
      entries = parsePatchPayload(body.patch);
    } catch (err) {
      return NextResponse.json(
        { error: 'patch_payload_invalid', detail: String(err) },
        { status: 400 },
      );
    }
    if (entries.length === 0) {
      return NextResponse.json({ ok: false, accepted: [], rejected: [], reason: 'empty_patch' });
    }
    if (entries.length > 30) {
      return NextResponse.json({ error: 'patch_too_large', max: 30 }, { status: 400 });
    }

    const { accepted, rejected } = validatePatch(entries);
    if (accepted.length === 0) {
      return NextResponse.json(
        { ok: false, accepted: [], rejected, reason: 'all_rejected' },
        { status: 400 },
      );
    }

    const userRef = adminDb.collection('users').doc(uid);

    try {
      const result = await adminDb.runTransaction(async (tx) => {
        // 1. Find active plan (read inside tx so we're race-safe vs regen)
        const plansActive = await tx.get(
          userRef.collection('plans').where('active', '==', true).limit(1),
        );
        if (plansActive.empty) {
          return { status: 404, body: { error: 'no_active_plan' } };
        }
        const planSnap = plansActive.docs[0];
        const plan = planSnap.data();
        const planId = planSnap.id;

        // 2. Apply
        const patched = applyPatchToPlan(plan, accepted);

        // 3. Snapshot old plan into plans_history before write
        const ts = new Date().toISOString();
        const historyRef = userRef.collection('plans_history').doc(ts);
        tx.set(historyRef, {
          ...plan,
          archived_at: ts,
          archived_reason: 'coach_patch',
          plan_id: planId,
        });

        // 4. Write patched plan back
        tx.update(planSnap.ref, {
          ...patched,
          last_patched_at: ts,
          last_patched_by: 'coach',
        });

        // 5. Audit log
        const auditRef = userRef.collection('coach_patches').doc();
        tx.set(auditRef, {
          applied_at: ts,
          plan_id: planId,
          accepted,
          rejected,
          reason: (body.reason ?? '').slice(0, 300),
          source: 'coach_chat',
        });

        return { status: 200, body: { ok: true, accepted, rejected, plan_id: planId } };
      });

      return NextResponse.json(result.body, { status: result.status });
    } catch (err) {
      console.error('[coach/apply-patch] tx failed:', err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'internal_error' },
        { status: 500 },
      );
    }
  });
}
