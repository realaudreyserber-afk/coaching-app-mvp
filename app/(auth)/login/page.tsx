"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { FirebaseError } from "firebase/app";
import { setPersistence, browserLocalPersistence, browserSessionPersistence } from "firebase/auth";
import { useAuth } from "@/lib/firebase/hooks";
import { auth } from "@/lib/firebase/client";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/ui/loader";
import { HudCard, PanelHeader } from "@/components/nodream";
import { Eye, EyeOff, Loader2 } from "lucide-react";

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

// Audit UX 2026-05-28 : useSearchParams() requiert Suspense boundary en Next 13+.
// On wrap LoginInner dans Suspense pour pouvoir préfetch ?redirect= sans crash
// du prerender static.
export default function LoginPage() {
  return (
    <Suspense fallback={<Loader size="fullscreen" message="Chargement..." />}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
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
  const searchParams = useSearchParams();
  // Audit UX 2026-05-28 #15 : honorer ?redirect=/some/path après login.
  // Sécurité : on n'accepte que les paths relatifs commençant par "/" pour
  // éviter open redirect vers domaine externe.
  const redirectParam = (() => {
    const r = searchParams?.get("redirect");
    if (!r) return null;
    // Whitelist : path interne uniquement, pas d'URL externe
    if (!r.startsWith("/") || r.startsWith("//")) return null;
    return r;
  })();

  // Audit UX 2026-05-28 : ?mode= présélectionne le formulaire. La landing
  // envoie "Commencer" → ?mode=signup (sinon un nouvel arrivant tombait sur
  // le formulaire de connexion). Défaut "signin" pour les visiteurs directs.
  const modeParam: Mode = (() => {
    const m = searchParams?.get("mode");
    return m === "signup" || m === "reset" ? m : "signin";
  })();

  const [mode, setMode] = useState<Mode>(modeParam);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false); // Audit #5 toggle visibilité
  const [rememberMe, setRememberMe] = useState(true); // Audit #6 "Se souvenir de moi"
  const [authError, setAuthError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Skip the redirect for anonymous users — they explicitly came to /login
    // to upgrade to a real account (Google / email). Auto-anonymous from
    // AuthProvider creates a user object as soon as the app mounts, which
    // would otherwise short-circuit the whole login flow.
    if (!loading && user && !user.isAnonymous) {
      // Audit UX 2026-05-28 #15 : si ?redirect= valide, on l'utilise.
      // Sinon fallback historique (dashboard si profil, onboarding sinon).
      if (redirectParam) {
        router.push(redirectParam);
      } else {
        router.push(hasProfile ? "/dashboard" : "/onboarding");
      }
    }
  }, [user, loading, hasProfile, router, redirectParam]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      // Audit UX 2026-05-28 #6 : appliquer la persistance AVANT login.
      // Remember me coché = local (survit fermeture navigateur).
      // Décoché = session (s'efface à la fermeture).
      if (mode !== "reset") {
        try {
          await setPersistence(
            auth,
            rememberMe ? browserLocalPersistence : browserSessionPersistence,
          );
        } catch (persistErr) {
          console.warn("[login] setPersistence failed (non-blocking):", persistErr);
        }
      }
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

  // Show the loader only when a REAL (non-anonymous) user is in transit to
  // /dashboard or /onboarding. Anonymous users on /login are here on purpose
  // to upgrade their account — they need to see the form, not a loader.
  if (loading || (user && !user.isAnonymous && !submitting)) {
    return (
      <Loader size="fullscreen" message="Préparation de ton espace de coaching..." />
    );
  }

  const passwordRequired = mode !== "reset";

  return (
    <div className="flex min-h-screen flex-col justify-center px-6 py-12 sm:px-6 lg:px-8 relative">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-2">
        <p
          className="mono cursor"
          style={{
            fontSize: 10,
            letterSpacing: '0.3em',
            color: 'var(--accent-tech)',
            textShadow: '0 0 6px var(--accent-tech)',
          }}
        >
          [BOOT-SEQUENCE] · ORACLE.IA · v1.0
        </p>
        <h1
          className="glow-gold"
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'clamp(2.4rem, 10vw, 4rem)',
            fontWeight: 900,
            letterSpacing: '-0.04em',
            lineHeight: 1,
            margin: 0,
            background: 'linear-gradient(135deg, #fff 0%, #d4af37 100%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          NoDream
        </h1>
        <p
          className="mono"
          style={{
            fontSize: 'var(--type-meta)',
            letterSpacing: '0.3em',
            color: 'var(--fg-3)',
            textTransform: 'uppercase',
            margin: 0,
          }}
        >
          Pas de rêve · Des résultats
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <HudCard accent="gold" chamfer="md" style={{ padding: '1.5rem' }}>
          <PanelHeader
            code={
              mode === "signin"
                ? "AUTH-LOGIN"
                : mode === "signup"
                  ? "AUTH-REGISTER"
                  : "AUTH-RESET"
            }
            title={
              mode === "signin"
                ? "Connexion"
                : mode === "signup"
                  ? "Création de compte"
                  : "Mot de passe oublié"
            }
            accent="gold"
          />
          <p
            style={{
              fontSize: 'var(--type-body-sm)',
              color: 'var(--fg-3)',
              lineHeight: 1.5,
              marginBottom: 16,
            }}
          >
            {/* Audit UX 2026-05-28 #7 : "Identification militaire chiffrée" → claim
                non vérifiable et juridiquement risqué. Remplacé par formulation
                factuelle (authentification Firebase + chiffrement TLS). */}
            {mode === "reset"
              ? "Renseigne ton email, on t'envoie un lien de réinitialisation."
              : "Authentification requise pour accéder à l'OS tactique. Chiffrement TLS de bout en bout."}
          </p>
          <div className="space-y-4">
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
                  {/* Audit UX 2026-05-28 #5 : toggle afficher/masquer mot de passe */}
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete={
                        mode === "signin" ? "current-password" : "new-password"
                      }
                      minLength={6}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full h-11 pl-3 pr-10 rounded-md border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                      aria-pressed={showPassword}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" aria-hidden />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden />
                      )}
                    </button>
                  </div>
                  {mode === "signup" && (
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      Minimum 6 caractères.
                    </p>
                  )}
                </div>
              )}

              {/* Audit UX 2026-05-28 #6 : Se souvenir de moi (Firebase persistence) */}
              {mode === "signin" && (
                <label className="flex items-center gap-2 text-xs text-foreground/70 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-border accent-primary"
                  />
                  Se souvenir de moi sur cet appareil
                </label>
              )}

              <Button
                type="submit"
                disabled={submitting}
                className="w-full h-11 rounded-md text-sm font-medium flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                {submitting
                  ? "Connexion…"
                  : mode === "signin"
                    ? "Se connecter"
                    : mode === "signup"
                      ? "Créer le compte"
                      : "Envoyer le lien"}
              </Button>
            </form>

            {/* Audit UX 2026-05-28 #3 : zone erreur sémantique avec role="alert"
                pour annonce immédiate au lecteur d'écran. */}
            {authError && (
              <p
                role="alert"
                aria-live="assertive"
                className="text-center text-xs text-red-500 font-medium bg-red-50 dark:bg-red-950/20 py-2 rounded-md"
              >
                {authError}
              </p>
            )}
            {info && (
              <p
                role="status"
                aria-live="polite"
                className="text-center text-xs text-green-700 font-medium bg-green-50 dark:bg-green-950/20 py-2 rounded-md"
              >
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
              {/* Audit UX 2026-05-28 #16 : logo Google officiel 4 couleurs
                  (Google brand guidelines). Source officielle SVG. */}
              <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              Continuer avec Google
            </Button>

            {/* Audit UX 2026-05-28 #1+#2 : liens cliquables vers /legal/terms et
                /legal/privacy + break-words pour éviter overflow */}
            <div className="pt-2 text-center break-words">
              <span className="text-[10px] text-muted-foreground leading-relaxed">
                En te connectant, tu acceptes nos{' '}
                <Link href="/legal/terms" className="underline hover:text-foreground">
                  conditions d'utilisation
                </Link>
                {' '}et notre{' '}
                <Link href="/legal/privacy" className="underline hover:text-foreground">
                  politique de confidentialité RGPD
                </Link>
                .
              </span>
            </div>
          </div>
        </HudCard>
      </div>
    </div>
  );
}
