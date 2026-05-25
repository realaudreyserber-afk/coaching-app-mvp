/* eslint-disable react/no-unescaped-entities */
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/firebase/hooks';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Loader2, Users, Award, ShieldAlert, BarChart3, TrendingDown } from 'lucide-react';

interface AdminMetrics {
  totalUsers: number;
  completedProfiles: number;
  wearablesConnected: number;
  averageWeightStart: number;
  averageWeightCurrent: number;
  glp1Count: number;
  bariatricCount: number;
  activeCohorts: {
    dau: number;
    wau: number;
    mau: number;
    ratio: number;
  };
  funnel: {
    registered: number;
    onboardingCompleted: number;
    firstCheckin: number;
    weeklyActive: number;
  };
}

export default function AdminPage() {
  const router = useRouter();
  const { getFreshToken } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const fetchAdminMetrics = async () => {
      setLoading(true);
      setErrorMsg(null);

      const isMockMode = typeof window !== 'undefined' && window.localStorage.getItem('mock_user') === 'true';
      if (isMockMode) {
        // Return mock data immediately for E2E tests
        setMetrics({
          totalUsers: 140,
          completedProfiles: 120,
          wearablesConnected: 35,
          averageWeightStart: 88.4,
          averageWeightCurrent: 84.1,
          glp1Count: 12,
          bariatricCount: 6,
          activeCohorts: { dau: 56, wau: 98, mau: 140, ratio: 40 },
          funnel: { registered: 140, onboardingCompleted: 120, firstCheckin: 102, weeklyActive: 98 }
        });
        setLoading(false);
        return;
      }

      try {
        const token = await getFreshToken();
        if (!token) {
          throw new Error('Authentification requise');
        }

        const res = await fetch('/api/admin/metrics', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!res.ok) {
          let serverErr = "Impossible de charger les statistiques d'administration.";
          try {
            const errData = await res.json();
            if (errData && errData.error) {
              serverErr = errData.error;
            }
          } catch (_) {}
          throw new Error(serverErr);
        }

        const data = await res.json();
        setMetrics(data.metrics);
      } catch (err: any) {
        console.error('Admin metrics error:', err);
        setErrorMsg(err.message || 'Erreur lors du chargement des données.');
      } finally {
        setLoading(false);
      }
    };

    fetchAdminMetrics();
  }, [getFreshToken]);

  const handleBack = () => {
    router.push('/dashboard');
  };

  return (
    <div className="flex-1 flex flex-col bg-background p-4 max-w-md mx-auto w-full space-y-6">
      
      {/* Header */}
      <div className="flex items-center space-x-3">
        <Button variant="ghost" size="icon" onClick={handleBack} className="h-10 w-10">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-serif font-bold text-foreground">Console Admin</h1>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground font-serif">Agrégation des cohortes utilisateurs...</p>
        </div>
      ) : errorMsg ? (
        <Card className="border-red-500/30 bg-red-500/5 text-red-800 dark:text-red-400">
          <CardContent className="p-6 text-center space-y-4">
            <ShieldAlert className="h-12 w-12 mx-auto text-red-600 dark:text-red-400" />
            <div className="space-y-1">
              <h2 className="text-base font-bold font-serif">Accès Réservé</h2>
              <p className="text-xs leading-relaxed">{errorMsg}</p>
            </div>
            <Button onClick={handleBack} className="w-full">
              Retour au Dashboard
            </Button>
          </CardContent>
        </Card>
      ) : metrics ? (
        <div className="space-y-6">
          
          {/* Main User Counter Card */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="border-border">
              <CardContent className="p-4 flex flex-col items-center text-center space-y-1">
                <Users className="h-5 w-5 text-primary" />
                <span className="text-2xl font-mono font-bold">{metrics.totalUsers}</span>
                <span className="text-[10px] text-muted-foreground">Inscriptions totales</span>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="p-4 flex flex-col items-center text-center space-y-1">
                <Award className="h-5 w-5 text-primary" />
                <span className="text-2xl font-mono font-bold">{metrics.activeCohorts.ratio}%</span>
                <span className="text-[10px] text-muted-foreground">Engagement (DAU/MAU)</span>
              </CardContent>
            </Card>
          </div>

          {/* Engagement Cohort card */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-serif">Activité des cohortes</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-2 text-center pt-2">
              <div className="bg-muted p-2 rounded-lg">
                <div className="text-[10px] text-muted-foreground">DAU (Jour)</div>
                <div className="text-sm font-bold font-mono">{metrics.activeCohorts.dau}</div>
              </div>
              <div className="bg-muted p-2 rounded-lg">
                <div className="text-[10px] text-muted-foreground">WAU (Semaine)</div>
                <div className="text-sm font-bold font-mono">{metrics.activeCohorts.wau}</div>
              </div>
              <div className="bg-muted p-2 rounded-lg">
                <div className="text-[10px] text-muted-foreground">MAU (Mois)</div>
                <div className="text-sm font-bold font-mono">{metrics.activeCohorts.mau}</div>
              </div>
            </CardContent>
          </Card>

          {/* Specific Cohorts counts */}
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-serif">Profils Spécifiques actifs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-1 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-serif">Cohort GLP-1 (Ozempic/Wegovy)</span>
                <span className="font-bold font-mono">{metrics.glp1Count}</span>
              </div>
              <div className="flex justify-between items-center border-t border-border pt-2">
                <span className="text-muted-foreground font-serif">Cohort Post-Chirurgie Bariatrique</span>
                <span className="font-bold font-mono">{metrics.bariatricCount}</span>
              </div>
              <div className="flex justify-between items-center border-t border-border pt-2">
                <span className="text-muted-foreground font-serif">Wearables connectés (Google Fit)</span>
                <span className="font-bold font-mono">{metrics.wearablesConnected}</span>
              </div>
            </CardContent>
          </Card>

          {/* Average Weight Change card */}
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-serif flex items-center space-x-1">
                <TrendingDown className="h-4 w-4 text-green-600" />
                <span>Poids Moyen Cohorte</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2 text-xs flex justify-around">
              <div>
                <span className="text-[10px] text-muted-foreground block text-center">Départ moyen</span>
                <span className="font-bold font-mono text-base block text-center">{metrics.averageWeightStart} kg</span>
              </div>
              <div className="border-l border-border h-8 self-center" />
              <div>
                <span className="text-[10px] text-muted-foreground block text-center">Actuel moyen</span>
                <span className="font-bold font-mono text-base block text-center">{metrics.averageWeightCurrent} kg</span>
              </div>
              <div className="border-l border-border h-8 self-center" />
              <div>
                <span className="text-[10px] text-muted-foreground block text-center">Delta moyen</span>
                <span className="font-bold font-mono text-base text-green-600 block text-center">
                  -{Math.round((metrics.averageWeightStart - metrics.averageWeightCurrent) * 10) / 10} kg
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Funnel chart */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-serif flex items-center space-x-1.5">
                <BarChart3 className="h-4 w-4" />
                <span>Entonnoir d'onboarding & conversion</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-2">
              {/* Step 1 */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-serif">
                  <span>1. Utilisateurs Inscrits</span>
                  <span className="font-mono font-semibold">{metrics.funnel.registered}</span>
                </div>
                <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: '100%' }} />
                </div>
              </div>
              
              {/* Step 2 */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-serif">
                  <span>2. Onboarding complété</span>
                  <span className="font-mono font-semibold">
                    {metrics.funnel.onboardingCompleted} ({Math.round((metrics.funnel.onboardingCompleted / metrics.funnel.registered) * 100)}%)
                  </span>
                </div>
                <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary/80" style={{ width: `${(metrics.funnel.onboardingCompleted / metrics.funnel.registered) * 100}%` }} />
                </div>
              </div>

              {/* Step 3 */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-serif">
                  <span>3. Premier Bilan (Check-in)</span>
                  <span className="font-mono font-semibold">
                    {metrics.funnel.firstCheckin} ({Math.round((metrics.funnel.firstCheckin / metrics.funnel.onboardingCompleted) * 100)}%)
                  </span>
                </div>
                <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary/60" style={{ width: `${(metrics.funnel.firstCheckin / metrics.funnel.registered) * 100}%` }} />
                </div>
              </div>

              {/* Step 4 */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-serif">
                  <span>4. Actifs cette semaine</span>
                  <span className="font-mono font-semibold">
                    {metrics.funnel.weeklyActive} ({Math.round((metrics.funnel.weeklyActive / metrics.funnel.firstCheckin) * 100)}%)
                  </span>
                </div>
                <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary/45" style={{ width: `${(metrics.funnel.weeklyActive / metrics.funnel.registered) * 100}%` }} />
                </div>
              </div>
            </CardContent>
          </Card>

        </div>
      ) : null}

    </div>
  );
}
