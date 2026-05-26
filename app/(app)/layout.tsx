"use client";

import { Loader } from "@/components/ui/loader";
import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/hooks";

import { TacticalHeader } from "@/components/nodream/tactical-header";
import { TacticalBottomNav } from "@/components/nodream/tactical-bottom-nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, hasProfile } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      // User is not logged in, redirect to login page
      router.push("/login");
      return;
    }

    const isOnboarding = pathname?.startsWith("/onboarding");

    // Force redirection to onboarding if user profile is incomplete
    if (!hasProfile && !isOnboarding) {
      router.push("/onboarding");
    } 
    // Prevent access to onboarding if profile is already complete
    else if (hasProfile && isOnboarding) {
      router.push("/dashboard");
    }
  }, [user, loading, hasProfile, pathname, router]);

  // Show a loading screen during initial authentication state resolution
  if (loading) {
    return (
      <Loader size="fullscreen" message="Accès à ton espace..." />
    );
  }

  // Prevent flash of protected page content while redirecting a profileless user to onboarding
  const isOnboarding = pathname?.startsWith("/onboarding");
  if (user && !hasProfile && !isOnboarding) {
    return null;
  }

  // Prevent flash of onboarding pages for user with complete profile
  if (user && hasProfile && isOnboarding) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-amber-500 focus:text-zinc-950 focus:font-semibold focus:rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
      >
        Aller au contenu principal
      </a>
      {!isOnboarding && <TacticalHeader />}
      <main
        id="main-content"
        tabIndex={-1}
        className={`flex-1 flex flex-col relative z-10 ${!isOnboarding ? "pb-20" : ""}`}
      >
        {children}
      </main>
      {!isOnboarding && <TacticalBottomNav />}
    </div>
  );
}
