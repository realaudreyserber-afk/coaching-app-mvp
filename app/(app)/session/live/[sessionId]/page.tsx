/**
 * Page /session/live/[sessionId] — DEPRECATED.
 *
 * L'architecture live tracking (1 write Firestore par set via API route)
 * causait des bugs récurrents d'écriture `undefined` (vs_previous_volume_pct,
 * loaded_kg, tempo_seconds, etc.). Le pattern industrie (Strong/Hevy/Jefit)
 * est offline-first : un seul POST à la fin de la séance avec toutes les
 * données. Le pivot vers ce pattern vit dans /session/log/[planId].
 *
 * L'historique git contient l'ancienne implémentation complète (face-cam
 * audio, file d'exécution A1/A2, rest timer, etc.) si elle doit être
 * ressuscitée en V2 avec un stockage IndexedDB local-first.
 */
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader } from "@/components/ui/loader";

export default function DeprecatedLiveSessionPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/session");
  }, [router]);
  return <Loader size="fullscreen" message="Redirection vers le sélecteur..." />;
}
