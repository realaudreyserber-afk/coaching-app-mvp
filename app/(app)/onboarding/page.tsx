"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useAuth } from "@/lib/firebase/hooks";
import { db } from "@/lib/firebase/client";

export default function OnboardingIndexPage() {
  const { user, loading, hasProfile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading || !user) return;

    const checkStepAndRedirect = async () => {
      try {
        if (hasProfile) {
          router.push("/dashboard");
          return;
        }

        const userDocRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userDocRef);

        if (!userSnap.exists()) {
          // Initialize user document if not exists yet
          await setDoc(userDocRef, {
            uid: user.uid,
            onboarding_step: 1,
            subscription: { tier: "free" },
            settings: { notifications: true, units: "metric", language: "fr" },
          });
          router.push("/onboarding/1");
        } else {
          const data = userSnap.data();
          const currentStep = data?.onboarding_step || 1;
          
          if (data?.profile !== undefined) {
            router.push("/dashboard");
          } else {
            router.push(`/onboarding/${currentStep}`);
          }
        }
      } catch (error) {
        console.error("Error directing user in onboarding:", error);
      }
    };

    checkStepAndRedirect();
  }, [user, loading, hasProfile, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4 dark:bg-anthracite">
      <div className="text-center space-y-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
        <p className="text-sm text-muted-foreground font-serif">Redirection vers ton parcours...</p>
      </div>
    </div>
  );
}
