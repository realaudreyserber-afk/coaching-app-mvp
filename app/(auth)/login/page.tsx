"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FirebaseError } from "firebase/app";
import { useAuth } from "@/lib/firebase/hooks";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader } from "@/components/ui/loader";

type Mode = "signin" | "signup" | "reset";

function friendlyFirebaseError(err: unknown): string {
  if (err instanceof FirebaseError) {
    switch (err.code) {
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found":
        return "Email ou mot de passe incorrect.";
      case "auth/email-already-in-use":
        return "Cet email a déjà un compte. Connecte-toi à la place.";
      case "auth/weak-password":
        return "Mot de passe trop faible (6 caractères minimum).";
      case "auth/invalid-email":
        return "Email invalide.";
      case "auth/too-many-requests":
        return "Trop de tentatives. Réessaie dans quelques minutes.";
      case "auth/network-request-failed":
        return "Problème réseau. Vérifie ta connexion.";
      case "auth/operation-not-allowed":
        return "L'auth email/password n'est pas activée. Active-la dans Firebase Console.";
      default:
        return `Erreur: ${err.message}`;
    }
  }
  return "Une erreur est survenue. Réessaie.";
}

export default function LoginPage() {
  const {
    user,
    loading,
    hasProfile,
    loginWithEmail,
    registerWithEmail,
    resetPassword,
    loginWithGoogle,
  } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.push(hasProfile ? "/dashboard" : "/onboarding");
    }
  }, [user, loading, hasProfile, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      if (mode === "signin") {
        await loginWithEmail(email, password);
      } else if (mode === "signup") {
        await registerWithEmail(email, password);
      } else if (mode === "reset") {
        await resetPassword(email);
        setInfo("Email de réinitialisation envoyé. Vérifie ta boîte.");
        setSubmitting(false);
      }
    } catch (err) {
      console.error(err);
      setAuthError(friendlyFirebaseError(err));
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setAuthError(null);
    setSubmitting(true);
    try {
      await loginWithGoogle();
    } catch (err) {
      console.error(err);
      setAuthError(
        "Google n'a pas répondu. Utilise plutôt email/mot de passe en attendant.",
      );
      setSubmitting(false);
    }
  };

  if (loading || (user && !submitting)) {
    return (
      <Loader size="fullscreen" message="Préparation de ton espace de coaching..." />
    );
  }

  const passwordRequired = mode !== "reset";

  return (
    <div className="flex min-h-screen flex-col justify-center bg-cream px-6 py-12 dark:bg-anthracite sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
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
            <CardTitle className="text-2xl font-serif font-medium">
              {mode === "signin"
                ? "Connecte-toi"
                : mode === "signup"
                  ? "Crée ton compte"
                  : "Mot de passe oublié"}
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground leading-relaxed">
              {mode === "reset"
                ? "Renseigne ton email, on t'envoie un lien de réinitialisation."
                : "Pas de fausses promesses ni de restriction extrême. On construit ensemble un plan adapté à ton corps."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label
                  htmlFor="email"
                  className="block text-xs font-medium text-foreground/80 mb-1"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-11 px-3 rounded-md border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {passwordRequired && (
                <div>
                  <label
                    htmlFor="password"
                    className="block text-xs font-medium text-foreground/80 mb-1"
                  >
                    Mot de passe
                  </label>
                  <input
                    id="password"
                    type="password"
                    autoComplete={
                      mode === "signin" ? "current-password" : "new-password"
                    }
                    minLength={6}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-11 px-3 rounded-md border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  {mode === "signup" && (
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      Minimum 6 caractères.
                    </p>
                  )}
                </div>
              )}

              <Button
                type="submit"
                disabled={submitting}
                className="w-full h-11 rounded-md text-sm font-medium"
              >
                {submitting
                  ? "..."
                  : mode === "signin"
                    ? "Se connecter"
                    : mode === "signup"
                      ? "Créer le compte"
                      : "Envoyer le lien"}
              </Button>
            </form>

            {authError && (
              <p className="text-center text-xs text-red-500 font-medium bg-red-50 dark:bg-red-950/20 py-2 rounded-md">
                {authError}
              </p>
            )}
            {info && (
              <p className="text-center text-xs text-green-700 font-medium bg-green-50 dark:bg-green-950/20 py-2 rounded-md">
                {info}
              </p>
            )}

            <div className="flex justify-between text-xs">
              {mode !== "signin" && (
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setAuthError(null);
                    setInfo(null);
                  }}
                  className="text-primary hover:underline"
                >
                  Se connecter
                </button>
              )}
              {mode !== "signup" && (
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setAuthError(null);
                    setInfo(null);
                  }}
                  className="text-primary hover:underline"
                >
                  Créer un compte
                </button>
              )}
              {mode !== "reset" && (
                <button
                  type="button"
                  onClick={() => {
                    setMode("reset");
                    setAuthError(null);
                    setInfo(null);
                  }}
                  className="text-muted-foreground hover:underline"
                >
                  Mot de passe oublié
                </button>
              )}
            </div>

            <div className="relative pt-2">
              <div className="absolute inset-0 flex items-center" aria-hidden>
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-card px-2 text-muted-foreground">
                  ou
                </span>
              </div>
            </div>

            <Button
              type="button"
              onClick={handleGoogleLogin}
              disabled={submitting}
              variant="outline"
              className="w-full h-11 flex items-center justify-center gap-3 rounded-md text-sm font-medium"
            >
              <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              Continuer avec Google
            </Button>

            <div className="pt-2 text-center">
              <span className="text-[10px] text-muted-foreground">
                {
                  "En te connectant, tu acceptes nos conditions d'utilisation et notre politique de confidentialité RGPD."
                }
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
