"use client";

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
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center space-y-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
        <p className="text-sm text-muted-foreground font-serif">Vérification de tes identifiants...</p>
      </div>
    </div>
  );
}
