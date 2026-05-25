"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { FirebaseError } from "firebase/app";
import { useAuth } from "@/lib/firebase/hooks";
import { db } from "@/lib/firebase/client";
import { Button } from "@/components/ui/button";

export default function OnboardingIndexPage() {
  const { user, loading, hasProfile } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user) return;

    const checkStepAndRedirect = async () => {
      try {
        if (hasProfile) {
          router.replace("/dashboard");
          return;
        }

        // Force a fresh ID token so Firestore SDK has the latest credentials
        // before our first read. Without this, a getDoc right after sign-up
        // sometimes lands before the auth gateway has propagated the token,
        // causing a spurious permission-denied.
        try {
          await user.getIdToken(true);
        } catch (refreshErr) {
          console.warn("[onboarding] token refresh warning:", refreshErr);
        }

        const userDocRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userDocRef);

        if (!userSnap.exists()) {
          await setDoc(userDocRef, {
            uid: user.uid,
            email: user.email ?? null,
            onboarding_step: 1,
            subscription: { tier: "free" },
            settings: {
              notifications: true,
              units: "metric",
              language: "fr",
            },
            created_at: new Date().toISOString(),
          });
          router.replace("/onboarding/1");
          return;
        }

        const data = userSnap.data();
        const currentStep = (data?.onboarding_step as number) || 1;

        if (data?.profile !== undefined) {
          router.replace("/dashboard");
        } else {
          router.replace(`/onboarding/${currentStep}`);
        }
      } catch (err) {
        console.error("[onboarding] redirect failed:", err);
        if (err instanceof FirebaseError) {
          if (err.code === "permission-denied") {
            setError(
              "Permission refusée par Firestore. Vérifie que tu es bien connecté(e). Si le problème persiste, déconnecte-toi et reconnecte-toi.",
            );
          } else {
            setError(`Erreur Firebase (${err.code}): ${err.message}`);
          }
        } else if (err instanceof Error) {
          setError(`Erreur: ${err.message}`);
        } else {
          setError("Erreur inconnue lors de la redirection.");
        }
      }
    };

    checkStepAndRedirect();
  }, [user, loading, hasProfile, router]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream px-4 dark:bg-anthracite">
        <div className="text-center space-y-4 max-w-md">
          <p className="text-sm text-red-600 dark:text-red-400 font-medium bg-red-50 dark:bg-red-950/20 p-3 rounded-md">
            {error}
          </p>
          <div className="flex flex-col gap-2">
            <Button onClick={() => router.replace("/onboarding/1")}>
              Aller à l'étape 1 quand même
            </Button>
            <Button
              variant="outline"
              onClick={() => router.replace("/login")}
            >
              Retour à la connexion
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4 dark:bg-anthracite">
      <div className="text-center space-y-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
        <p className="text-sm text-muted-foreground font-serif">
          Redirection vers ton parcours...
        </p>
      </div>
    </div>
  );
}
