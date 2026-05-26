/**
 * POST /api/coach/apply-patch
 *
 * Body: { patch: PatchEntry[] | Record<string, PatchValue>; reason?: string }
 *
 * Applies a coach-generated patch to the user's ACTIVE plan in a transaction.
 *
 * Post-Wave-6 review fixes (C1, C2, C3):
 *  - C1 : we no longer spread `...patched` into tx.update — that wipes
 *    concurrent fields. Instead we issue a **partial** update with only
 *    the paths the patch touched, using Firestore dotted FieldPaths.
 *  - C2 : plans_history doc id uses auto-id, with `archived_at` stored as
 *    a field — avoids collision on same-ms ISO timestamps.
 *  - C3 : applyPatchToPlan still computes a full snapshot in memory but is
 *    only used here to validate the resulting shape (e.g. cardio stays
 *    well-formed). We do NOT write that snapshot back.
 *  - H3 : when at least one path is applied, we patch `source` →
 *    'ai+coach_patched' so audit reads reflect the human-in-the-loop intent.
 */
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldPath, FieldValue } from 'firebase-admin/firestore';
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
    // L3 fix : cap to 10 entries — beyond that, regenerate the plan instead.
    if (entries.length > 10) {
      return NextResponse.json({ error: 'patch_too_large', max: 10 }, { status: 400 });
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

        // 2. L2 fix : pre-flight check that every patch target's parent
        // object exists in the current plan. If parent missing, reject the
        // patch entry instead of autovivifying a partial structure.
        const aliveEntries: PatchEntry[] = [];
        const parentMissing: Array<{ path: string; reason: string }> = [];
        for (const entry of accepted) {
          const parts = entry.path.split('.');
          let cursor: any = plan;
          let valid = true;
          for (let i = 0; i < parts.length - 1; i++) {
            const key = parts[i];
            const isIndex = /^\d+$/.test(key);
            if (isIndex) {
              const idx = parseInt(key, 10);
              if (!Array.isArray(cursor) || cursor[idx] === undefined) { valid = false; break; }
              cursor = cursor[idx];
            } else {
              if (typeof cursor !== 'object' || cursor === null || cursor[key] === undefined) {
                valid = false; break;
              }
              cursor = cursor[key];
            }
          }
          if (valid) aliveEntries.push(entry);
          else parentMissing.push({ path: entry.path, reason: 'parent_missing' });
        }
        if (aliveEntries.length === 0) {
          return {
            status: 400,
            body: { ok: false, accepted: [], rejected: [...rejected, ...parentMissing], reason: 'parents_missing' },
          };
        }

        // 3. Validate post-shape via in-memory apply (sanity check — not persisted)
        applyPatchToPlan(plan, aliveEntries);

        // 4. C2 fix : snapshot to plans_history with auto-id (avoid ISO collision)
        const ts = new Date().toISOString();
        const historyRef = userRef.collection('plans_history').doc();
        tx.set(historyRef, {
          ...plan,
          archived_at: ts,
          archived_reason: 'coach_patch',
          plan_id: planId,
        });

        // 5. C1 fix : write ONLY the patched paths via FieldPath partial update.
        // This way two concurrent patches that touch different fields don't
        // overwrite each other.
        const partialUpdate: Record<string | symbol, unknown> = {
          last_patched_at: ts,
          last_patched_by: 'coach',
          // H3 fix : mark plan as ai-generated + human-patched for the audit trail
          source: 'ai+coach_patched',
        };
        for (const entry of aliveEntries) {
          // Convert "training.sessions.0.exercises.2.sets" to FieldPath segments
          const segments = entry.path.split('.');
          // Firestore FieldPath() expects each segment as a separate arg;
          // numeric indices stay as strings, that's how Firestore addresses
          // map keys with numeric names.
          tx.update(planSnap.ref, new FieldPath(...segments), entry.value);
        }
        // Apply the meta fields in one update (FieldPath form for safety)
        tx.update(planSnap.ref, partialUpdate);

        // 6. Audit log (auto-id, includes both accepted + rejected paths)
        const auditRef = userRef.collection('coach_patches').doc();
        tx.set(auditRef, {
          applied_at: ts,
          plan_id: planId,
          accepted: aliveEntries,
          rejected: [...rejected, ...parentMissing],
          reason: (body.reason ?? '').slice(0, 300),
          source: 'coach_chat',
          history_ref: historyRef.id,
        });

        return {
          status: 200,
          body: {
            ok: true,
            accepted: aliveEntries,
            rejected: [...rejected, ...parentMissing],
            plan_id: planId,
            history_ref: historyRef.id,
          },
        };
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

// Silence unused-import linter — FieldValue kept for future arrayUnion usage
void FieldValue;
