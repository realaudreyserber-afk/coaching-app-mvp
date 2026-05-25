/* eslint-disable react/no-unescaped-entities */
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { doc, getDoc, collection, query, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/firebase/hooks';
import { flags } from '@/lib/features/flags';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Loader2, CheckCircle2, AlertTriangle, Link2, RefreshCw, Smartphone } from 'lucide-react';

export default function ConnectionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  
  const [isFlagActive, setIsFlagActive] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ steps: number, caloriesBurned: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    setIsFlagActive(flags.wearables());
  }, []);

  // Parse query params for redirect status
  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    if (success) {
      setSuccessMsg("Google Fit a été connecté avec succès !");
    }
    if (error) {
      setErrorMsg("Impossible d'authentifier ton compte Google Fit.");
    }
  }, [searchParams]);

  useEffect(() => {
    if (isFlagActive === null || !isFlagActive || !user) return;

    const checkConnectionStatus = async () => {
      setLoading(true);
      
      const isMockMode = typeof window !== 'undefined' && window.localStorage.getItem('mock_user') === 'true';
      if (isMockMode) {
        setConnected(true);
        setLoading(false);
        return;
      }

      try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const profile = userSnap.data()?.profile;
          setConnected(!!profile?.wearables_connected);
        }
      } catch (err) {
        console.error('Error fetching wearables status:', err);
      } finally {
        setLoading(false);
      }
    };

    checkConnectionStatus();
  }, [isFlagActive, user]);

  const handleConnectGoogleFit = () => {
    if (!user) return;
    // Redirect to backend OAuth initiator page
    window.location.href = `/api/auth/google-fit?uid=${user.uid}`;
  };

  const handleSync = async () => {
    if (!user) return;
    setSyncing(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const isMockMode = typeof window !== 'undefined' && window.localStorage.getItem('mock_user') === 'true';
    if (isMockMode) {
      // Mock sync immediately in test environment
      setTimeout(() => {
        setSyncResult({ steps: 8520, caloriesBurned: 412 });
        setSuccessMsg("Synchronisation réussie (Simulé).");
        setSyncing(false);
      }, 500);
      return;
    }

    try {
      // Retrieve fresh ID token
      const res = await fetch('/api/user/sync-wearables', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Erreur lors de la synchronisation.');
      }

      const data = await res.json();
      setSyncResult(data.metrics);
      setSuccessMsg("Données d'activité synchronisées avec succès !");
    } catch (err: any) {
      console.error('Wearables sync error:', err);
      setErrorMsg(err.message || "La synchronisation avec Google Fit a échoué.");
    } finally {
      setSyncing(false);
    }
  };

  if (isFlagActive === null) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background px-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Feature flag check
  if (!isFlagActive) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center py-10 px-6 bg-background text-center space-y-6">
        <Card className="max-w-md w-full border-border">
          <CardHeader className="space-y-2">
            <span className="text-4xl">🚧</span>
            <CardTitle className="text-2xl font-serif">Module en cours de déploiement</CardTitle>
            <CardDescription>
              La synchronisation d'objets connectés n'est pas encore disponible dans ta zone.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/dashboard')} className="w-full">
              Retour au Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-background p-4 max-w-md mx-auto w-full space-y-6">
      
      {/* Header */}
      <div className="flex items-center space-x-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-10 w-10">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-serif font-bold text-foreground">Connexions Santé</h1>
      </div>

      <div className="space-y-4">
        
        {/* Status notification */}
        {successMsg && (
          <Card className="border-green-500/20 bg-green-500/10 text-green-700 dark:text-green-300">
            <CardContent className="flex items-start space-x-3 p-4">
              <CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <h4 className="font-semibold text-sm">Parfait !</h4>
                <p className="text-xs">{successMsg}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {errorMsg && (
          <Card className="border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300">
            <CardContent className="flex items-start space-x-3 p-4">
              <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <h4 className="font-semibold text-sm">Échec de la connexion</h4>
                <p className="text-xs">{errorMsg}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sync Summary details */}
        {syncResult && (
          <Card className="border-primary bg-primary/5 text-primary">
            <CardContent className="p-4 space-y-2">
              <div className="text-xs uppercase font-bold tracking-wider">Métriques importées aujourd'hui</div>
              <div className="grid grid-cols-2 gap-4 pt-1">
                <div>
                  <div className="text-[10px] text-muted-foreground">Pas comptés</div>
                  <div className="text-lg font-bold font-mono">{syncResult.steps} pas</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">Dépense active estimée</div>
                  <div className="text-lg font-bold font-mono">{syncResult.caloriesBurned} kcal</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Google Fit Card */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-lg font-serif">Google Fit</CardTitle>
                <CardDescription className="text-xs">
                  Synchronise tes pas et dépenses énergétiques actives quotidiens.
                </CardDescription>
              </div>
              <div className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-green-600' : 'bg-muted'}`} />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="flex items-center space-x-2 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground">Vérification de la connexion...</span>
              </div>
            ) : connected ? (
              <div className="flex space-x-2 w-full">
                <Button 
                  onClick={handleSync} 
                  disabled={syncing}
                  className="flex-1 space-x-2 h-10"
                >
                  {syncing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  <span>Synchroniser maintenant</span>
                </Button>
              </div>
            ) : (
              <Button 
                onClick={handleConnectGoogleFit}
                className="w-full space-x-2 h-11"
              >
                <Link2 className="h-4 w-4" />
                <span>Connecter Google Fit</span>
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Native Stubs (Health Connect / HealthKit) */}
        <Card className="border-border opacity-70">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-serif flex items-center space-x-2">
              <Smartphone className="h-4 w-4 text-primary" />
              <span>Apple HealthKit & Android Health Connect</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Directement intégré sur notre application mobile native pour synchroniser ta montre Apple Watch, Garmin, Withings ou Fitbit.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
              Disponible prochainement sur App Store & Play Store
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
