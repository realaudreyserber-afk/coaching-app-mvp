"use client";

import { useRouter } from 'next/navigation';
import { useSubscription } from '@/lib/stripe/hooks';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Crown, Loader2 } from 'lucide-react';
import type { SubscriptionTier } from '@/lib/stripe/subscription';

export function PremiumGate({
  children,
  requires = 'premium',
  featureName = 'cette fonctionnalité',
}: {
  children: React.ReactNode;
  requires?: SubscriptionTier;
  featureName?: string;
}) {
  const router = useRouter();
  const { loading, can } = useSubscription();

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!can(requires)) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Crown className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="font-serif text-2xl">Premium requis</CardTitle>
            <CardDescription>
              Pour accéder à {featureName}, passe à l&apos;abonnement Premium. Pause ou résiliation possible à tout moment.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/settings/subscription')} className="w-full h-11">
              Voir les plans
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
