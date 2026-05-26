/* eslint-disable react/no-unescaped-entities */
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/firebase/hooks';
import { flags } from '@/lib/features/flags';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Loader2, AlertCircle, Info, Sparkles } from 'lucide-react';
import { Micronutrients, MICRONUTRIENT_RDA } from '@/lib/features/micronutrients/schema';
import { calculateDailyMicronutrients } from '@/lib/features/micronutrients/micronutrient-calc';

// Dietary recommendations for each nutrient
const NUTRIENT_FOOD_SOURCES: Record<keyof Micronutrients, string[]> = {
  calcium: ["Fromage blanc", "Yaourt grec", "Lait", "Brocoli", "Amandes"],
  magnesium: ["Épinards", "Avocat", "Amandes", "Flocons d'avoine", "Chocolat noir"],
  potassium: ["Pomme de terre", "Avocat", "Banane", "Épinards", "Brocoli"],
  iron: ["Steak haché de bœuf", "Épinards", "Œuf entier", "Lentilles"],
  zinc: ["Steak haché de bœuf", "Œuf entier", "Flocons d'avoine", "Graines de courge"],
  sodium: ["Thon en boîte", "Fromage blanc", "Sel de table (avec modération)"],
  vitaminA: ["Œuf entier", "Carottes", "Patates douces", "Épinards"],
  vitaminC: ["Brocoli", "Oranges", "Clémentines", "Tomates", "Poivrons"],
  vitaminD: ["Pavé de saumon", "Thon en boîte", "Œuf entier", "Exposition solaire"],
  vitaminE: ["Huile d'olive", "Amandes", "Avocat", "Noisettes"],
  vitaminK: ["Épinards", "Brocoli", "Haricots verts", "Chou"],
  vitaminB6: ["Blanc de poulet", "Steak haché", "Banane", "Pavé de saumon"],
  vitaminB9: ["Épinards", "Brocoli", "Avocat", "Haricots verts", "Asperges"],
  vitaminB12: ["Steak haché de bœuf", "Pavé de saumon", "Thon en boîte", "Œuf entier", "Fromage blanc"],
};

export default function MicronutrientsDashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [isFlagActive, setIsFlagActive] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [todayNutrients, setTodayNutrients] = useState<Micronutrients | null>(null);
  const [deficiencies, setDeficiencies] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setIsFlagActive(flags.micronutrients());
  }, []);

  useEffect(() => {
    if (isFlagActive === null || !isFlagActive || !user) return;

    const fetchLogsAndCalc = async () => {
      setLoading(true);
      setErrorMsg(null);
      
      const isMockMode = typeof window !== 'undefined' && window.localStorage.getItem('mock_user') === 'true';

      if (isMockMode) {
        setTodayNutrients({
          calcium: 400,
          magnesium: 150,
          potassium: 2200,
          iron: 8,
          zinc: 6,
          sodium: 1200,
          vitaminA: 600,
          vitaminC: 80,
          vitaminD: 5,
          vitaminE: 6,
          vitaminK: 45,
          vitaminB6: 1.1,
          vitaminB9: 200,
          vitaminB12: 2.5
        });
        setDeficiencies(['calcium', 'magnesium']);
        setLoading(false);
        return;
      }

      // Wave 13B — Use local YYYY-MM-DD (Europe time) instead of UTC. The
      // previous toISOString().split('T') showed tomorrow's date for users
      // in CEST evening (after ~22h UTC).
      const localYmd = (d: Date) =>
        d.toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });
      const todayStr = localYmd(new Date());
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      const startStr = localYmd(sevenDaysAgo);

      try {
        // Wave 13B — Single range query for the full 7-day window instead
        // of 7 parallel `where('date', '==', day)` queries. Saves 6
        // round-trips per page mount and bypasses the need for a separate
        // "today" query.
        const qRange = query(
          collection(db, 'users', user.uid, 'food_logs'),
          where('date', '>=', startStr),
          where('date', '<=', todayStr),
        );
        const snapshotRange = await getDocs(qRange);
        const byDay = new Map<string, any[]>();
        snapshotRange.docs.forEach((d) => {
          const data = d.data() as any;
          const dateStr = data?.date ?? '';
          if (!dateStr) return;
          const bucket = byDay.get(dateStr) ?? [];
          bucket.push(data);
          byDay.set(dateStr, bucket);
        });

        const logsToday = byDay.get(todayStr) ?? [];
        const computedToday = calculateDailyMicronutrients(logsToday);
        setTodayNutrients(computedToday);

        // Build the 7-day list (skip empty days from the average)
        const logsLast7Days: any[] = [];
        byDay.forEach((dayLogs) => {
          if (dayLogs.length > 0) {
            logsLast7Days.push(calculateDailyMicronutrients(dayLogs));
          }
        });

        // Compute averages and identify recurring deficiencies (<70% of RDA on average)
        if (logsLast7Days.length >= 3) { // Need at least 3 tracked days to show relevant trends
          const averages: Partial<Record<keyof Micronutrients, number>> = {};
          const keys = Object.keys(MICRONUTRIENT_RDA) as (keyof Micronutrients)[];

          keys.forEach(key => {
            const sum = logsLast7Days.reduce((acc, day) => acc + (day[key] || 0), 0);
            averages[key] = sum / logsLast7Days.length;
          });

          const lowNutrients = keys.filter(key => {
            const avg = averages[key] || 0;
            const rda = MICRONUTRIENT_RDA[key].value;
            // Sodium is a max limit, not a minimum requirement, do not flag as deficiency
            if (key === 'sodium') return false;
            return avg < rda * 0.7;
          });

          setDeficiencies(lowNutrients);
        } else {
          setDeficiencies([]);
        }

      } catch (err: any) {
        console.error('Error fetching micronutrient logs:', err);
        setErrorMsg('Impossible de charger tes statistiques de micronutriments.');
      } finally {
        setLoading(false);
      }
    };

    fetchLogsAndCalc();
  }, [isFlagActive, user]);

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
            <span className="mono" style={{fontSize:10,letterSpacing:'0.3em',color:'var(--accent-tech)',textTransform:'uppercase',display:'inline-block',padding:'4px 10px',border:'1px solid var(--accent-tech)',fontWeight:700}}>[BETA]</span>
            <CardTitle className="text-2xl font-serif">Module en cours de déploiement</CardTitle>
            <CardDescription>
              Le suivi détaillé des micronutriments n'est pas encore disponible dans ta zone.
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
        <h1 className="text-xl font-serif font-bold text-foreground">Suivi des Micronutriments</h1>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground font-serif">Chargement des données de référence...</p>
        </div>
      ) : errorMsg ? (
        <Card className="border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300">
          <CardContent className="p-4 flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span className="text-xs">{errorMsg}</span>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          
          {/* Sourcing Info banner */}
          <div className="flex items-start space-x-2 p-3 rounded-lg bg-primary/10 border border-primary/20 text-[11px] text-primary leading-normal">
            <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>
              <strong>Données factuelles certifiées :</strong> Ces statistiques sont calculées uniquement sur les tables officielles USDA/Ciqual et l'API Open Food Facts. Aucune estimation artificielle n'est utilisée pour éviter les hallucinations.
            </span>
          </div>

          {/* Deficiency Warnings & Food Advice */}
          {deficiencies.length > 0 && (
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-amber-700 dark:text-amber-400 font-bold uppercase tracking-wider flex items-center space-x-1.5">
                  <Sparkles className="h-4 w-4" />
                  <span>Ajustements nutritionnels recommandés</span>
                </CardTitle>
                <CardDescription className="text-[11px]">
                  Sur les 7 derniers jours, tes apports sont insuffisants sur les micronutriments suivants. Optimise ton alimentation avec ces aliments denses :
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                {deficiencies.slice(0, 3).map((defKey) => {
                  const key = defKey as keyof Micronutrients;
                  const rda = MICRONUTRIENT_RDA[key];
                  return (
                    <div key={key} className="text-xs space-y-1">
                      <div className="font-semibold text-foreground font-serif">
                        • {rda.name} (carence relative)
                      </div>
                      <div className="text-muted-foreground text-[11px] pl-3">
                        Ajoute à tes repas : {NUTRIENT_FOOD_SOURCES[key].join(', ')}.
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Micronutrient lists */}
          <div className="space-y-4">
            <h2 className="text-sm font-serif font-bold text-foreground">Apports du jour J</h2>
            
            <div className="grid grid-cols-1 gap-3">
              {(Object.keys(MICRONUTRIENT_RDA) as (keyof Micronutrients)[]).map((key) => {
                const rda = MICRONUTRIENT_RDA[key];
                const current = todayNutrients ? todayNutrients[key] : 0;
                
                // Calculate percentage (for sodium, it is a limit, so handle styling accordingly)
                const pct = Math.min(100, Math.round((current / rda.value) * 100));
                
                let progressColor = 'bg-red-500';
                if (key === 'sodium') {
                  progressColor = current > rda.value ? 'bg-red-500' : 'bg-green-600';
                } else if (pct >= 100) {
                  progressColor = 'bg-green-600';
                } else if (pct >= 70) {
                  progressColor = 'bg-amber-500';
                }

                return (
                  <Card key={key} className="border-border">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex justify-between text-xs font-serif font-semibold">
                        <span>{rda.name}</span>
                        <span className="text-muted-foreground font-mono">
                          {current} / {rda.value} {rda.unit} {key !== 'sodium' && `(${pct}%)`}
                        </span>
                      </div>
                      
                      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${progressColor} transition-all duration-300`} 
                          style={{ width: `${key === 'sodium' ? Math.min(100, (current / rda.value) * 100) : pct}%` }}
                        />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          <div className="text-[10px] text-muted-foreground text-center leading-relaxed px-4">
            <strong>Rappel médical :</strong> Ces informations visent à optimiser ton alimentation globale. N'entreprends aucune supplémentation en vitamines/minéraux isolés sans l'avis d'un professionnel de santé suite à un bilan sanguin.
          </div>

        </div>
      )}

    </div>
  );
}
