import { redirect } from "next/navigation";
import { LandingPage } from "@/components/landing/landing-page";

function isConfigured(): boolean {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  return Boolean(apiKey && apiKey.length > 0 && !apiKey.startsWith('mock-'));
}

/**
 * Racine `/` — landing page publique (NoDream Tactical OS).
 *
 * Avant, la racine redirigeait tout le monde vers /dashboard (cf. audit Auth) ;
 * aucune vitrine n'existait pour les visiteurs non connectés. On rend désormais
 * la landing, dont le CTA est auth-aware (connecté → /dashboard, sinon → /login).
 * On conserve le saut vers /setup quand Firebase n'est pas configuré.
 */
export default function Home() {
  if (!isConfigured()) {
    redirect('/setup');
  }
  return <LandingPage />;
}
