"use client";

import { useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/lib/firebase/hooks';
import { getUserVariantIndex, logExperimentExposure, logExperimentConversion } from './framework';

export interface ExperimentConfig<V extends string> {
  id: string;
  variants: readonly V[];
}

export function useExperiment<V extends string>(experiment: ExperimentConfig<V>): {
  variant: V;
  loading: boolean;
  trackConversion: (type: string) => Promise<void>;
} {
  const { user, loading } = useAuth();
  const loggedRef = useRef(false);

  const variant = useMemo<V>(() => {
    if (!user) return experiment.variants[0];
    const idx = getUserVariantIndex(user.uid, experiment.id, experiment.variants.length);
    return experiment.variants[idx];
  }, [user, experiment.id, experiment.variants]);

  useEffect(() => {
    if (loading || !user || loggedRef.current) return;
    loggedRef.current = true;
    void logExperimentExposure(user.uid, experiment.id, variant);
  }, [user, loading, experiment.id, variant]);

  const trackConversion = async (type: string) => {
    if (!user) return;
    await logExperimentConversion(user.uid, experiment.id, type);
  };

  return { variant, loading, trackConversion };
}
