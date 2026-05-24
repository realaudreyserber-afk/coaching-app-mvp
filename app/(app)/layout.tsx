"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/hooks";

import TopBar from "@/components/navigation/top-bar";
import BottomNav from "@/components/navigation/bottom-nav";

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
      <div className="flex min-h-screen items-center justify-center bg-cream px-4 dark:bg-anthracite">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-sm text-muted-foreground font-serif">{"Accès à ton espace..."}</p>
        </div>
      </div>
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
    <div className="min-h-screen flex flex-col bg-cream dark:bg-anthracite">
      {!isOnboarding && <TopBar />}
      <main className={`flex-1 flex flex-col ${!isOnboarding ? "pb-20" : ""}`}>{children}</main>
      {!isOnboarding && <BottomNav />}
    </div>
  );
}
