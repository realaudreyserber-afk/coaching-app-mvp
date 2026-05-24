import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb, adminStorage } from "@/lib/firebase/admin";
import { withAuth } from "@/lib/firebase/auth-middleware";

export async function DELETE(req: NextRequest) {
  return withAuth(req, async (authenticatedReq, user) => {
    try {
      const uid = user.uid;
      const userRef = adminDb.collection("users").doc(uid);

      // 1. Delete all photos in Google Cloud Storage recursively
      if (adminStorage) {
        try {
          const bucket = adminStorage.bucket();
          await bucket.deleteFiles({ prefix: `users/${uid}/` });
        } catch (storageErr) {
          console.error("GCS Files deletion failed or already deleted:", storageErr);
        }
      }

      // 2. Fetch and delete Firestore subcollections in batches
      const subcollections = ["checkins_daily", "checkins_weekly", "plans", "photos", "alerts"];
      for (const subcol of subcollections) {
        const snap = await userRef.collection(subcol).get();
        if (snap.size > 0) {
          const batch = adminDb.batch();
          snap.docs.forEach((doc) => {
            batch.delete(doc.ref);
          });
          await batch.commit();
        }
      }

      // 3. Delete user root document
      await userRef.delete();

      // 4. Delete user Auth profile
      if (adminAuth) {
        await adminAuth.deleteUser(uid);
      }

      return NextResponse.json({
        success: true,
        message: "Compte et données personnelles supprimés avec succès.",
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
