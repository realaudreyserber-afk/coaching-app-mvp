"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const { user, loading, hasProfile, loginWithGoogle } = useAuth();
  const [authError, setAuthError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      if (hasProfile) {
        router.push("/dashboard");
      } else {
        router.push("/onboarding");
      }
    }
  }, [user, loading, hasProfile, router]);

  const handleGoogleLogin = async () => {
    setSigningIn(true);
    setAuthError(null);
    try {
      await loginWithGoogle();
    } catch (error) {
      console.error(error);
      setAuthError("La connexion a échoué. S'il te plaît, réessaie.");
      setSigningIn(false);
    }
  };

  if (loading || (user && !signingIn)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream px-4 dark:bg-anthracite">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-sm text-muted-foreground font-serif">Préparation de ton espace de coaching...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col justify-center bg-cream px-6 py-12 dark:bg-anthracite sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Editorial Brand Name */}
        <h1 className="text-center text-4xl font-extrabold tracking-tight font-serif text-primary">
          NoDream
        </h1>
        <p className="mt-2 text-center text-sm text-muted-foreground font-serif italic">
          Pas de rêve. Des résultats.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card className="border border-border/80 shadow-md bg-card/50 backdrop-blur-sm">
          <CardHeader className="space-y-2 text-center">
            <CardTitle className="text-2xl font-serif font-medium">Rejoins la transformation</CardTitle>
            <CardDescription className="text-sm text-muted-foreground leading-relaxed">
              Ici, pas de fausses promesses ni de restriction extrême. Nous construisons ensemble un plan nutritionnel et sportif adapté à ton corps et ton rythme de vie.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={handleGoogleLogin}
              disabled={signingIn}
              className="w-full flex items-center justify-center gap-3 h-12 rounded-lg text-base font-medium shadow-sm transition-all"
            >
              {signingIn ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-cream border-t-transparent" />
              ) : (
                <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
              )}
              {signingIn ? "Connexion en cours..." : "Continuer avec Google"}
            </Button>

            {authError && (
              <p className="text-center text-xs text-red-500 font-medium bg-red-50 dark:bg-red-950/20 py-2 rounded-md">
                {authError}
              </p>
            )}

            <div className="pt-4 text-center">
              <span className="text-xs text-muted-foreground">
                {"En te connectant, tu acceptes nos conditions d'utilisation et notre politique de confidentialité RGPD."}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
