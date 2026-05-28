import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminFieldValue } from "@/lib/firebase/admin";
import { withAuth } from "@/lib/firebase/auth-middleware";

interface DocLike { id: string; data: () => Record<string, unknown> }

// Audit QA sécurité : l'export RGPD listait dynamiquement TOUTES les
// sous-collections (dont `tokens/` = refresh tokens OAuth) et renvoyait le doc
// profil brut (avec wearable.*.access_token/refresh_token en clair). On rédige
// donc toute clé de type secret et on exclut la sous-collection de tokens.
// (Les tokens OAuth sont des secrets d'infra, pas des données personnelles que
// l'utilisateur a besoin de récupérer — leur exposer serait une fuite.)
const SECRET_KEY = /(_token$|^access_token$|^refresh_token$|^id_token$|secret|api_key|client_secret)/i;
const EXCLUDED_SUBCOLLECTIONS = new Set(["tokens"]);

function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEY.test(k) ? "[REDACTED]" : redactSecrets(v);
    }
    return out;
  }
  return value;
}

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
        profile: redactSecrets(userSnap.data()),
      };

      const subcollections = await userRef.listCollections();
      const collectionEntries = await Promise.all(
        subcollections.map(async (sub) => {
          if (EXCLUDED_SUBCOLLECTIONS.has(sub.id)) {
            return [sub.id, "[exclu de l'export — secrets OAuth, non exportables]"] as const;
          }
          const docs = await sub.get();
          return [
            sub.id,
            docs.docs.map((d: DocLike) => redactSecrets({ id: d.id, ...d.data() })),
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
