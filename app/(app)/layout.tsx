"use client";

import { Loader } from "@/components/ui/loader";
import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/hooks";
import { useSubscription } from "@/lib/stripe/hooks";
import { isPaywallEnabled } from "@/lib/stripe/subscription";

import { TacticalHeader } from "@/components/nodream/tactical-header";
import { TacticalBottomNav } from "@/components/nodream/tactical-bottom-nav";
import { ConfirmProvider } from "@/components/ui/confirm-dialog";
import { Paywall } from "@/components/billing/paywall";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, hasProfile } = useAuth();
  const { access, loading: subLoading } = useSubscription();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      // Préserve la page demandée (deep-link) pour le retour post-login,
      // cohérent avec proxy.ts qui utilise aussi ?next=. La page login lit ce
      // paramètre (whitelist anti-open-redirect en place).
      const dest =
        pathname && pathname !== "/login"
          ? `/login?next=${encodeURIComponent(pathname)}`
          : "/login";
      router.push(dest);
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

  // Focus mode: hide BottomNav during live session — the user is mid-workout.
  // Header stays (so they can see ORACLE.IA status + abort).
  const isLiveSession = pathname?.startsWith("/session/live");
  const hideChrome = isOnboarding;
  const hideBottomNav = isOnboarding || isLiveSession;

  // Paywall (modèle essai 14 j → abonnement). No-op tant que
  // NEXT_PUBLIC_ENABLE_PAYWALL !== '1'. Quand actif : si l'accès est `locked`
  // (essai terminé, pas premium), on remplace le contenu par le Paywall —
  // SAUF sur /settings (dont l'abonnement + l'export/suppression RGPD) et /legal,
  // qui restent accessibles. L'onboarding n'est jamais paywallé.
  const onAllowlistedRoute =
    !!pathname && (pathname.startsWith("/settings") || pathname.startsWith("/legal"));
  const showPaywall =
    isPaywallEnabled() &&
    !subLoading &&
    access.locked &&
    !onAllowlistedRoute &&
    !isOnboarding;

  return (
    <ConfirmProvider>
      <div className="min-h-screen flex flex-col bg-background">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-amber-500 focus:text-zinc-950 focus:font-semibold focus:rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
        >
          Aller au contenu principal
        </a>
        {!hideChrome && <TacticalHeader />}
        <main
          id="main-content"
          tabIndex={-1}
          className={`flex-1 flex flex-col relative z-10 ${!hideBottomNav ? "pb-20" : ""}`}
        >
          {showPaywall ? <Paywall /> : children}
        </main>
        {!hideBottomNav && <TacticalBottomNav />}
      </div>
    </ConfirmProvider>
  );
}
