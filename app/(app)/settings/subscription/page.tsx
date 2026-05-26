"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/firebase/hooks';
import { useSubscription } from '@/lib/stripe/hooks';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TierCard } from '@/components/ui/tier-card';
import { Loader } from '@/components/ui/loader';
import { ArrowLeft, Crown, Loader2, ExternalLink } from 'lucide-react';

/**
 * Wave 13A — Allowlist of Stripe origins we trust to redirect to. If the
 * /api/stripe/checkout or /api/stripe/portal response was ever compromised
 * to return an arbitrary URL, we'd otherwise navigate the user anywhere
 * (phishing risk). Stripe-hosted pages live on these origins only.
 */
const STRIPE_ALLOWED_ORIGINS = [
  'https://checkout.stripe.com',
  'https://billing.stripe.com',
];

function isAllowedStripeUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false;
  try {
    const u = new URL(url);
    return STRIPE_ALLOWED_ORIGINS.includes(u.origin);
  } catch {
    return false;
  }
}

/**
 * Wave 13A — Firestore returns the period-end either as an ISO string (when
 * the server wrote new Date().toISOString()) or as a Timestamp (when the
 * Cloud Function wrote FieldValue.serverTimestamp()). new Date() on a
 * Timestamp returns Invalid Date → "Invalid Date" rendered. Normalize.
 */
function formatPeriodEnd(raw: unknown): string | null {
  if (!raw) return null;
  let date: Date | null = null;
  if (typeof raw === 'string' || typeof raw === 'number') {
    date = new Date(raw);
  } else if (
    typeof raw === 'object' &&
    raw !== null &&
    typeof (raw as { toDate?: () => Date }).toDate === 'function'
  ) {
    try {
      date = (raw as { toDate: () => Date }).toDate();
    } catch {
      date = null;
    }
  } else if (
    typeof raw === 'object' &&
    raw !== null &&
    typeof (raw as { seconds?: number }).seconds === 'number'
  ) {
    date = new Date((raw as { seconds: number }).seconds * 1000);
  }
  if (!date || Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('fr-FR');
}

export default function SubscriptionPage() {
  const router = useRouter();
  const { getFreshToken } = useAuth();
  const { state: subState, loading, premium } = useSubscription();
  const [action, setAction] = useState<'monthly' | 'yearly' | 'portal' | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const startCheckout = async (interval: 'monthly' | 'yearly') => {
    setAction(interval);
    setErr(null);
    try {
      const token = await getFreshToken();
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ interval }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || 'Erreur lors du checkout.');
      if (!isAllowedStripeUrl(data.url)) {
        throw new Error('URL de paiement invalide. Réessaye ou contacte le support.');
      }
      window.location.href = data.url;
    } catch (e: any) {
      setErr(e.message);
      setAction(null);
    }
  };

  const openPortal = async () => {
    setAction('portal');
    setErr(null);
    try {
      const token = await getFreshToken();
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || 'Erreur portail.');
      if (!isAllowedStripeUrl(data.url)) {
        throw new Error('URL portail invalide. Réessaye ou contacte le support.');
      }
      window.location.href = data.url;
    } catch (e: any) {
      setErr(e.message);
      setAction(null);
    }
  };

  if (loading) {
    return <Loader size="fullscreen" message="Chargement de ton abonnement..." />;
  }

  const FEATURES = [
    "Plan IA personnalisé recalibré chaque semaine",
    "Coach IA conversationnel avec sources scientifiques",
    "Bilans hebdomadaires + analyse photos de progrès",
    "Suivi détaillé poids, mensurations, micronutriments",
  ];

  return (
    <div className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10 space-y-8">
      <div className="flex items-center space-x-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/settings')}
          aria-label="Retour aux réglages"
          className="h-11 w-11"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Button>
        <h1 className="text-3xl lg:text-4xl font-bold font-serif text-zinc-50">Abonnement</h1>
      </div>

      {premium ? (
        <Card className="border border-amber-500/40 bg-zinc-900">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Crown className="h-5 w-5 text-amber-500" aria-hidden="true" />
              <CardTitle className="text-2xl font-serif text-zinc-50">Premium actif</CardTitle>
            </div>
            <CardDescription className="text-zinc-400">
              {(() => {
                const renewal = formatPeriodEnd(subState?.current_period_end);
                return renewal ? <>Renouvellement le {renewal}.</> : null;
              })()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              onClick={openPortal}
              disabled={action === 'portal'}
              aria-label="Gérer mon abonnement Premium"
              className="w-full h-11"
            >
              {action === 'portal' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : (
                <>
                  <ExternalLink className="h-4 w-4 mr-2" aria-hidden="true" />
                  Gérer mon abonnement (pause, changer, annuler)
                </>
              )}
            </Button>
            <p className="text-xs text-zinc-400 text-center">
              Tu peux mettre en pause jusqu&apos;à 3 mois, changer de plan ou annuler. Tes données restent intactes.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div>
            <h2 className="text-2xl lg:text-3xl font-serif font-bold text-zinc-50">
              Passe au niveau supérieur
            </h2>
            <p className="text-sm text-zinc-400 mt-2">
              Tout NoDream sans limite : IA, coach, analyses, suivi premium.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 max-w-3xl">
            <TierCard
              name="Mensuel"
              price="9,99 €/mois"
              subtitle="Sans engagement, résiliable à tout moment."
              features={FEATURES}
              ctaLabel="Choisir mensuel"
              onCta={() => startCheckout('monthly')}
              loading={action === 'monthly'}
              recommended
            />
            <TierCard
              name="Annuel"
              price="83,90 €/an"
              subtitle="Soit 6,99 €/mois. Économie de 30 % vs le mensuel."
              features={FEATURES}
              ctaLabel="Choisir annuel"
              onCta={() => startCheckout('yearly')}
              loading={action === 'yearly'}
              ctaVariant="outline"
            />
          </div>
        </>
      )}

      {err && (
        <div
          role="alert"
          className="text-sm text-red-300 bg-red-950/40 border border-red-900 p-3 rounded"
        >
          {err}
        </div>
      )}
    </div>
  );
}
