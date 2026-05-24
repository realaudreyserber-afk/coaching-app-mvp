/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, query, orderBy, limit, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/firebase/hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import WeightChart, { WeightDataPoint } from "@/components/dashboard/weight-chart";
import { Calendar, MessageSquare, TrendingUp, Sparkles, Plus } from "lucide-react";

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<any>(null);
  const [goals, setGoals] = useState<any>(null);
  const [todayCheckin, setTodayCheckin] = useState<any>(null);
  const [chartData, setChartData] = useState<WeightDataPoint[]>([]);
  const [fetching, setFetching] = useState(true);
  const [aiInsight, setAiInsight] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user) return;

    const loadDashboardData = async () => {
      try {
        const todayStr = new Date().toISOString().split("T")[0];

        // 1. Load User Profile
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const uData = userSnap.data();
          setProfile(uData.profile);
          setGoals(uData.goals);
        }

        // 2. Check if Today's Checkin exists
        const todayCheckinRef = doc(db, "users", user.uid, "checkins_daily", todayStr);
        const todaySnap = await getDoc(todayCheckinRef);
        if (todaySnap.exists()) {
          const tcData = todaySnap.data();
          setTodayCheckin(tcData);

          // Retrieve AI insight if we saved it in the checkin doc
          // (or let the background process or API populate it)
          // For now, if today's checkin exists, fetch the insight from API or checkin data
          // We also fetch it dynamically if it exists on the checkin doc
          try {
            // Check if checkin document contains a cached insight from api response
            const response = await fetch(`/api/ai/daily-insight`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                // Set a mock header for safety or get token, since we are client-side we can pass token if needed
              },
              body: JSON.stringify({ checkin: tcData }),
            });
            if (response.ok) {
              const resData = await response.json();
              setAiInsight(resData?.insight);
            }
          } catch (e) {
            console.error("Failed to load insight on dashboard:", e);
          }
        }

        // 3. Load past 14 daily checkins for chart
        const checkinsRef = collection(db, "users", user.uid, "checkins_daily");
        const checkinsQuery = query(checkinsRef, orderBy("created_at", "desc"), limit(14));
        const checkinsSnap = await getDocs(checkinsQuery);

        const checkinsList: any[] = [];
        checkinsSnap.forEach((doc) => {
          checkinsList.push({
            dateStr: doc.id, // YYYY-MM-DD
            weight: doc.data().weight,
            ...doc.data(),
          });
        });

        // Compute rolling averages (requires sorting ascending)
        if (checkinsList.length > 0) {
          const sortedList = [...checkinsList].sort((a, b) => a.dateStr.localeCompare(b.dateStr));
          const formattedData = sortedList.map((c, idx) => {
            let sum = 0;
            let count = 0;
            // Go back up to 6 elements to compute 7-day average
            for (let i = Math.max(0, idx - 6); i <= idx; i++) {
              sum += sortedList[i].weight;
              count++;
            }
            return {
              date: c.dateStr.substring(5), // MM-DD format
              weight: c.weight,
              average: parseFloat((sum / count).toFixed(2)),
            };
          });
          setChartData(formattedData);
        }

        setFetching(false);
      } catch (err) {
        console.error("Error loading dashboard data:", err);
        setFetching(false);
      }
    };

    loadDashboardData();
  }, [user, loading]);

  if (loading || fetching) {
    return (
      <div className="flex-1 flex items-center justify-center bg-cream px-4 dark:bg-anthracite">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-sm text-muted-foreground font-serif">Ouverture de ton espace...</p>
        </div>
      </div>
    );
  }

  // Calculate progress stats
  const currentWeight = chartData[chartData.length - 1]?.weight || profile?.weight || 0;
  const startWeight = profile?.weight || currentWeight;
  const targetWeight = goals?.target_weight || 0;
  const deltaPoids = currentWeight - startWeight;
  const targetDelta = targetWeight - startWeight;
  
  // Calculate completion percentage towards target weight
  let progressPercentage = 0;
  if (targetDelta !== 0 && deltaPoids !== 0) {
    progressPercentage = Math.min(100, Math.max(0, Math.round((deltaPoids / targetDelta) * 100)));
  }

  return (
    <div className="flex-1 max-w-md w-full mx-auto px-4 py-6 space-y-6">
      {/* Greetings Header */}
      <div>
        <h2 className="text-3xl font-bold font-serif text-foreground">
          Salut {profile?.name || "athlète"} !
        </h2>
        <p className="text-sm text-muted-foreground">
          Voici l'état de ta transformation aujourd'hui.
        </p>
      </div>

      {/* Daily Checkin Status Card */}
      {!todayCheckin ? (
        <Card className="border border-orange-burnt/30 bg-orange-light/30 dark:bg-primary/5 shadow-sm">
          <CardHeader className="p-4 flex flex-row items-center gap-3 space-y-0">
            <Calendar className="h-8 w-8 text-primary" />
            <div className="flex-1">
              <CardTitle className="text-base font-serif font-bold text-primary">Bilan du jour incomplet</CardTitle>
              <CardDescription className="text-xs">
                Prends 30 secondes pour enregistrer tes indicateurs et ton poids.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <Button
              onClick={() => router.push("/checkin/daily")}
              className="w-full flex items-center justify-center gap-2 h-10 rounded-md"
            >
              <Plus className="h-4 w-4" /> Faire mon check-in
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border border-border/80 bg-card shadow-xs">
          <CardHeader className="p-4 flex flex-row items-center gap-3 space-y-0 pb-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-serif font-semibold">Insight du jour</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-sm italic font-serif leading-relaxed text-foreground/90">
              {aiInsight ? `"${aiInsight}"` : "Ton insight quotidien est en cours de recalibrage..."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Weight Chart Card */}
      <div className="space-y-2">
        <h3 className="text-lg font-serif font-semibold text-foreground px-1">Suivi du Poids Moyen Glissant</h3>
        <WeightChart data={chartData} />
        <p className="text-[10px] text-muted-foreground px-1 text-center">
          La courbe sombre représente la moyenne glissante (7j) pour lisser les fluctuations d'eau.
        </p>
      </div>

      {/* Progress metrics */}
      <Card className="border border-border bg-card shadow-xs">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base font-serif font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> Objectif de Transformation
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-muted p-2 rounded-md">
              <span className="text-[10px] uppercase text-muted-foreground block">Départ</span>
              <span className="text-sm font-semibold">{startWeight} kg</span>
            </div>
            <div className="bg-primary/10 p-2 rounded-md">
              <span className="text-[10px] uppercase text-primary block">Actuel</span>
              <span className="text-sm font-semibold text-primary">{currentWeight} kg</span>
            </div>
            <div className="bg-muted p-2 rounded-md">
              <span className="text-[10px] uppercase text-muted-foreground block">Objectif</span>
              <span className="text-sm font-semibold">{targetWeight} kg</span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs font-medium">
              <span>Progression globale</span>
              <span>{progressPercentage}%</span>
            </div>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary rounded-full transition-all duration-500" 
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-2 gap-4 pb-4">
        <Button
          variant="outline"
          onClick={() => router.push("/coach")}
          className="flex flex-col items-center justify-center gap-1 h-16 rounded-xl text-xs font-semibold"
        >
          <MessageSquare className="h-4 w-4 text-primary" /> Parler au Coach IA
        </Button>
        <Button
          variant="outline"
          onClick={() => router.push("/checkin/weekly")}
          className="flex flex-col items-center justify-center gap-1 h-16 rounded-xl text-xs font-semibold"
        >
          <Calendar className="h-4 w-4 text-primary" /> Bilan Hebdomadaire
        </Button>
      </div>
    </div>
  );
}
