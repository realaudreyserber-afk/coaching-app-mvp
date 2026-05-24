import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminFieldValue } from "@/lib/firebase/admin";
import { withAuth } from "@/lib/firebase/auth-middleware";

interface DocLike { id: string; data: () => Record<string, unknown> }

export async function GET(req: NextRequest) {
  return withAuth(req, async (_authReq, user) => {
    try {
      const uid = user.uid;
      const userRef = adminDb.collection("users").doc(uid);
      const userSnap = await userRef.get();

      if (!userSnap.exists) {
        return NextResponse.json({ error: "Utilisateur non trouvé." }, { status: 404 });
      }

      const exportData: Record<string, unknown> = {
        exportedAt: new Date().toISOString(),
        uid,
        profile: userSnap.data(),
      };

      const subcollections = await userRef.listCollections();
      const collectionEntries = await Promise.all(
        subcollections.map(async (sub) => {
          const docs = await sub.get();
          return [
            sub.id,
            docs.docs.map((d: DocLike) => ({ id: d.id, ...d.data() })),
          ] as const;
        })
      );
      for (const [name, docs] of collectionEntries) {
        exportData[name] = docs;
      }

      await adminDb.collection("rgpd_audit_log").add({
        uid,
        action: "export",
        actor_email: user.email ?? null,
        timestamp: adminFieldValue.serverTimestamp(),
      });

      return new NextResponse(JSON.stringify(exportData, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename=linsociable_export_${uid}_${new Date().toISOString().split("T")[0]}.json`,
        },
      });
    } catch (error) {
      console.error("Error exporting user data:", error);
      const errMsg = error instanceof Error ? error.message : String(error);
      return NextResponse.json(
        { error: "Impossible d'exporter tes données personnelles.", details: errMsg },
        { status: 500 }
      );
    }
  });
}
