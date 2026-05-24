import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { withAuth } from "@/lib/firebase/auth-middleware";

export async function GET(req: NextRequest) {
  return withAuth(req, async (authenticatedReq, user) => {
    try {
      const uid = user.uid;
      const userRef = adminDb.collection("users").doc(uid);
      const userSnap = await userRef.get();

      if (!userSnap.exists) {
        return NextResponse.json(
          { error: "Utilisateur non trouvé." },
          { status: 404 }
        );
      }

      // Fetch all collections in parallel
      const [dailySnap, weeklySnap, plansSnap] = await Promise.all([
        userRef.collection("checkins_daily").orderBy("created_at", "desc").get(),
        userRef.collection("checkins_weekly").orderBy("created_at", "desc").get(),
        userRef.collection("plans").orderBy("created_at", "desc").get(),
      ]);

      const dailyCheckins = dailySnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const weeklyCheckins = weeklySnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const plans = plansSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const exportData = {
        exportedAt: new Date().toISOString(),
        profile: userSnap.data(),
        history: {
          dailyCheckins,
          weeklyCheckins,
          plans,
        }
      };

      // Set headers to trigger a file download on client-side
      return new NextResponse(JSON.stringify(exportData, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename=linsociable_export_${uid}.json`,
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
