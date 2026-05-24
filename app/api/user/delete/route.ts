import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb, adminStorage, adminFieldValue } from "@/lib/firebase/admin";
import { withAuth } from "@/lib/firebase/auth-middleware";

export const dynamic = 'force-dynamic';

async function purgeUser(uid: string): Promise<{ subs_purged: number; storage_files_deleted: number }> {
  const userRef = adminDb.collection("users").doc(uid);

  // 1. List ALL subcollections dynamically (covers food_logs, coach_messages,
  //    bloodwork, body_scans, form_checks, daily_tasks, streak, alerts,
  //    insights_daily, notification_log, tdee_history, wearable_sync, …)
  const subcollections = await userRef.listCollections();
  let subsPurged = 0;
  for (const sub of subcollections) {
    const docs = await sub.listDocuments();
    if (docs.length === 0) continue;
    // Batch limit is 500 — chunk if needed
    for (let i = 0; i < docs.length; i += 400) {
      const batch = adminDb.batch();
      docs.slice(i, i + 400).forEach((d) => batch.delete(d));
      await batch.commit();
    }
    subsPurged++;
  }

  // 2. Storage purge
  let storageDeleted = 0;
  try {
    const bucket = adminStorage.bucket();
    const [files] = await bucket.getFiles({ prefix: `users/${uid}/` });
    storageDeleted = files.length;
    await bucket.deleteFiles({ prefix: `users/${uid}/` });
  } catch (storageErr) {
    console.error("GCS purge failed (continuing):", storageErr);
  }

  // 3. Root user doc
  await userRef.delete();

  // 4. Auth profile + refresh tokens
  try {
    await adminAuth.revokeRefreshTokens(uid);
    await adminAuth.deleteUser(uid);
  } catch (authErr) {
    console.error("Auth purge failed:", authErr);
  }

  return { subs_purged: subsPurged, storage_files_deleted: storageDeleted };
}

async function checkRecentReauth(authTimeSec: number | undefined): Promise<boolean> {
  if (!authTimeSec) return false;
  const nowSec = Math.floor(Date.now() / 1000);
  return nowSec - authTimeSec < 5 * 60;
}

// POST (preferred — supports body with confirmation token)
export async function POST(req: NextRequest) {
  return withAuth(req, async (_authReq, user) => {
    try {
      const body = await req.json().catch(() => ({}));
      if (body?.confirmText !== 'EFFACER') {
        return NextResponse.json(
          { error: "Confirmation requise : envoie confirmText='EFFACER'." },
          { status: 400 }
        );
      }

      // Mock auth bypass for E2E in dev
      const isMock =
        process.env.ENABLE_MOCK_AUTH === '1' &&
        process.env.NODE_ENV !== 'production' &&
        user.email?.endsWith('@coaching.local');

      if (!isMock) {
        const authHeader = req.headers.get('authorization');
        const token = authHeader?.split('Bearer ')[1];
        if (token) {
          try {
            const decoded = await adminAuth.verifyIdToken(token);
            const recent = await checkRecentReauth(decoded.auth_time as number | undefined);
            if (!recent) {
              return NextResponse.json(
                { error: "Reconnexion requise dans les 5 dernières minutes." },
                { status: 403 }
              );
            }
          } catch {
            return NextResponse.json({ error: "Token invalide." }, { status: 401 });
          }
        }
      }

      // Audit log BEFORE the destructive op (so it persists)
      await adminDb.collection('rgpd_audit_log').add({
        uid: user.uid,
        action: 'delete',
        actor_email: user.email ?? null,
        timestamp: adminFieldValue.serverTimestamp(),
      });

      const stats = await purgeUser(user.uid);

      return NextResponse.json({
        success: true,
        message: "Compte et données personnelles supprimés avec succès.",
        ...stats,
      });
    } catch (error) {
      console.error("Error deleting user profile and data:", error);
      const errMsg = error instanceof Error ? error.message : String(error);
      return NextResponse.json(
        { error: "Impossible de supprimer ton compte.", details: errMsg },
        { status: 500 }
      );
    }
  });
}

// DELETE kept for backward compat with legacy clients (no confirmText required)
export async function DELETE(req: NextRequest) {
  return withAuth(req, async (_authReq, user) => {
    try {
      await adminDb.collection('rgpd_audit_log').add({
        uid: user.uid,
        action: 'delete_legacy',
        actor_email: user.email ?? null,
        timestamp: adminFieldValue.serverTimestamp(),
      });
      const stats = await purgeUser(user.uid);
      return NextResponse.json({ success: true, ...stats });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      return NextResponse.json(
        { error: "Impossible de supprimer ton compte.", details: errMsg },
        { status: 500 }
      );
    }
  });
}
