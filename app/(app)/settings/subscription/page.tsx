"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/firebase/hooks';
import { useSubscription } from '@/lib/stripe/hooks';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Crown, Loader2, ExternalLink, CheckCircle } from 'lucide-react';

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
      window.location.href = data.url;
    } catch (e: any) {
      setErr(e.message);
      setAction(null);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-4 max-w-md mx-auto w-full space-y-6">
      <div className="flex items-center space-x-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/settings')} className="h-10 w-10">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-serif font-bold">Abonnement</h1>
      </div>

      {premium ? (
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Crown className="h-5 w-5 text-primary" />
              <CardTitle className="text-2xl font-serif">Premium actif</CardTitle>
            </div>
            <CardDescription>
              {subState?.current_period_end && (
                <>Renouvellement le {new Date(subState.current_period_end).toLocaleDateString('fr-FR')}.</>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={openPortal} disabled={action === 'portal'} className="w-full h-11">
              {action === 'portal' ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                <>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Gérer mon abonnement (pause, changer, annuler)
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Tu peux mettre en pause jusqu'à 3 mois, changer de plan ou annuler. Tes données restent intactes.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-2xl font-serif">Mensuel</CardTitle>
              <CardDescription>Sans engagement, résiliable à tout moment.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="text-sm space-y-1.5">
                <li className="flex items-center"><CheckCircle className="h-4 w-4 text-primary mr-2" /> Plan IA personnalisé</li>
                <li className="flex items-center"><CheckCircle className="h-4 w-4 text-primary mr-2" /> Coach IA conversationnel</li>
                <li className="flex items-center"><CheckCircle className="h-4 w-4 text-primary mr-2" /> Bilans hebdomadaires</li>
                <li className="flex items-center"><CheckCircle className="h-4 w-4 text-primary mr-2" /> Photos de progrès analysées</li>
              </ul>
              <Button onClick={() => startCheckout('monthly')} disabled={action === 'monthly'} className="w-full h-11">
                {action === 'monthly' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Choisir mensuel'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-2xl font-serif">Annuel <span className="text-xs text-primary uppercase">-30%</span></CardTitle>
              <CardDescription>Engagement 12 mois, accès complet.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => startCheckout('yearly')} disabled={action === 'yearly'} variant="outline" className="w-full h-11">
                {action === 'yearly' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Choisir annuel'}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {err && (
        <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 p-3 rounded">
          {err}
        </div>
      )}
    </div>
  );
}
