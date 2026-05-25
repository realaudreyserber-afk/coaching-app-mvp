"use client";

import { Loader } from "@/components/ui/loader";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getRedirectResult } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useAuth } from "@/lib/firebase/hooks";

export default function CallbackPage() {
  const { user, loading, hasProfile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const handleRedirect = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result?.user || user) {
          if (hasProfile) {
            router.push("/dashboard");
          } else {
            router.push("/onboarding");
          }
        } else if (!loading && !user) {
          router.push("/login");
        }
      } catch (error) {
        console.error("Error processing Google sign-in redirect:", error);
        router.push("/login?error=redirect_failed");
      }
    };

    handleRedirect();
  }, [user, loading, hasProfile, router]);

  return (
    <Loader size="fullscreen" message="Vérification de tes identifiants..." />
  );
}
