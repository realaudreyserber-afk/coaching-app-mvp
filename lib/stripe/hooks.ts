"use client";

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/firebase/hooks';
import type { SubscriptionState, SubscriptionTier } from './subscription';
import { canAccessFeature, isPremium, computeAccess } from './subscription';

export function useSubscription() {
  const { user } = useAuth();
  const [state, setState] = useState<SubscriptionState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setState(null);
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        const sub = (snap.data()?.subscription ?? null) as SubscriptionState | null;
        setState(sub);
        setLoading(false);
      },
      (err) => {
        console.error('useSubscription snapshot error:', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [user]);

  return {
    state,
    loading,
    premium: isPremium(state),
    can: (required: SubscriptionTier) => canAccessFeature(state, required),
    /** État d'accès trial-aware (essai/premium/locked + jours restants). */
    access: computeAccess(state),
  };
}
