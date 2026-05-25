/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, query, orderBy, limit, getDocs, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/firebase/hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import WeightChart, { WeightDataPoint } from "@/components/dashboard/weight-chart";
import { Calendar, MessageSquare, TrendingUp, Sparkles, Plus, Clock, CheckSquare, Trophy } from "lucide-react";
import { flags } from "@/lib/features/flags";
import { getFastingState } from "@/lib/features/fasting/fasting-util";
import { getDailyTaskForUser } from "@/lib/features/micro-tasks/selector";

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<any>(null);
  const [goals, setGoals] = useState<any>(null);
  const [baseline, setBaseline] = useState<any>(null);
  const [todayCheckin, setTodayCheckin] = useState<any>(null);
  const [chartData, setChartData] = useState<WeightDataPoint[]>([]);
  const [fetching, setFetching] = useState(true);
  const [aiInsight, setAiInsight] = useState<string | null>(null);

  // Phase C state variables
  const [featureFastingActive, setFeatureFastingActive] = useState(false);
  const [featureMicroTasksActive, setFeatureMicroTasksActive] = useState(false);
  const [featureStreakActive, setFeatureStreakActive] = useState(false);
  
  const [fastingState, setFastingState] = useState<any>(null);
  const [dailyTask, setDailyTask] = useState<any>(null);
  const [taskCompleted, setTaskCompleted] = useState(false);
  const [streak, setStreak] = useState<any>(null);

  const handleCompleteTask = async () => {
    if (!user || !dailyTask) return;
    const todayStr = new Date().toISOString().split("T")[0];
    try {
      const taskDocRef = doc(db, "users", user.uid, "daily_tasks", todayStr);
      await setDoc(taskDocRef, {
        taskId: dailyTask.id,
        completed: true,
        completedAt: new Date().toISOString(),
      });
      setTaskCompleted(true);
    } catch (e) {
      console.error("Failed to complete daily task:", e);
    }
  };

  useEffect(() => {
    if (loading || !user) return;

    const loadDashboardData = async () => {
      try {
        const todayStr = new Date().toISOString().split("T")[0];

        // Enable feature flags
        const fastingEnabled = flags.fasting();
        const microTasksEnabled = flags.microTasks();
        const streakEnabled = flags.streak();

        setFeatureFastingActive(fastingEnabled);
        setFeatureMicroTasksActive(microTasksEnabled);
        setFeatureStreakActive(streakEnabled);

        // Check for mock user bypass (E2E testing)
        const isMockMode = typeof window !== 'undefined' && window.localStorage.getItem('mock_user') === 'true';

        if (isMockMode) {
          setProfile({ name: "Athlète Test", height: 180, weight: 80, activity_level: "lightly_active" });
          setGoals({ target_weight: 75 });
          setBaseline({ weight: 82, bf_pct: 22 });
          setTodayCheckin({ weight: 80, steps: 10000 });
          setChartData([
            { date: "05-20", weight: 82, average: 82 },
            { date: "05-21", weight: 81.5, average: 81.75 },
            { date: "05-22", weight: 81, average: 81.5 },
            { date: "05-23", weight: 80.5, average: 81.25 },
            { date: "05-24", weight: 80, average: 81.0 },
          ]);

          if (fastingEnabled) {
            setFastingState({
              isEatingWindow: false,
              timeRemainingMs: 4 * 60 * 60 * 1000,
              label: "Période de jeûne active. Fin dans 4h 0m."
            });
          }

          if (streakEnabled) {
            setStreak({ current: 5, longest: 10, lastCheckinDate: todayStr });
          }

          if (microTasksEnabled) {
            setDailyTask({
              id: "mock_task",
              text: "Boit un grand verre d'eau plate dès le réveil.",
              category: "nutrition"
            });
            setTaskCompleted(false);
          }

          setFetching(false);
          return;
        }

        // 1. Load User Profile
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const uData = userSnap.data();
          setProfile(uData.profile);
          setGoals(uData.goals);
          setBaseline(uData.baseline);

          // Fasting state calculation
          if (fastingEnabled && uData.fasting_protocol) {
            const fState = getFastingState(uData.fasting_protocol);
            setFastingState(fState);
          }

          // Streak data
          if (streakEnabled && uData.streak) {
            setStreak(uData.streak);
          }

          // Daily Micro-task selection & status
          if (microTasksEnabled) {
            const task = getDailyTaskForUser(uData.profile_path, todayStr);
            setDailyTask(task);

            const taskDocRef = doc(db, "users", user.uid, "daily_tasks", todayStr);
            const taskDocSnap = await getDoc(taskDocRef);
            setTaskCompleted(taskDocSnap.exists() && taskDocSnap.data()?.completed === true);
          }
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
            const idToken = await user.getIdToken();
            const response = await fetch(`/api/ai/daily-insight`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${idToken}`,
              },
              body: JSON.stringify({ checkin: tcData }),
            });
            if (response.ok) {
              const resData = await response.json();
              setAiInsight(resData?.insight);
            } else if (response.status !== 401 && response.status !== 404) {
              console.warn(`daily-insight returned ${response.status}`);
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
      <div className="flex-1 flex items-center justify-center bg-background px-4">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-sm text-muted-foreground font-serif">Ouverture de ton espace...</p>
        </div>
      </div>
    );
  }

  // Calculate progress stats
  const startWeight = baseline?.weight ?? profile?.weight ?? 0;
  const currentWeight =
    todayCheckin?.weight ??
    chartData[chartData.length - 1]?.weight ??
    profile?.weight ??
    startWeight;
  const targetWeight = goals?.target_weight || 0;
  const deltaPoids = currentWeight - startWeight;
  const targetDelta = targetWeight - startWeight;
  
  // Calculate completion percentage towards target weight
  let progressPercentage = 0;
  if (targetDelta !== 0 && deltaPoids !== 0) {
    progressPercentage = Math.min(100, Math.max(0, Math.round((deltaPoids / targetDelta) * 100)));
  }

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10 space-y-6 lg:space-y-8">
      {/* Greetings Header */}
      <div>
        <div className="flex justify-between items-baseline">
          <h2 className="text-3xl lg:text-4xl font-bold font-serif text-foreground">
            Salut {profile?.name || "athlète"} !
          </h2>
          {featureStreakActive && streak && streak.current > 0 && (
            <div className="flex items-center gap-1 text-xs font-semibold text-primary font-mono bg-primary/10 px-2 py-0.5 rounded-full" title="Régularité active">
              <span>🔥 {streak.current} {streak.current === 1 ? 'jour' : 'jours'}</span>
            </div>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Voici l'état de ta transformation aujourd'hui.
        </p>
      </div>

      {/* Top status row : checkin / fasting / micro-task — grid up to 3 cols on lg */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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

      {/* Fasting Protocol Status Card */}
      {featureFastingActive && fastingState && (
        <Card className="border border-border bg-card shadow-xs">
          <CardHeader className="p-4 flex flex-row items-center gap-3 space-y-0 pb-2">
            <Clock className="h-5 w-5 text-primary animate-pulse" />
            <div>
              <CardTitle className="text-base font-serif font-semibold">Jeûne Intermittent</CardTitle>
              <CardDescription className="text-[10px]">Statut en temps réel</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex items-center justify-between">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                fastingState.isEatingWindow 
                  ? "bg-green-100 text-green-700 dark:bg-green-950/20 dark:text-green-400" 
                  : "bg-orange-100 text-orange-700 dark:bg-orange-950/20 dark:text-orange-400"
              }`}>
                {fastingState.isEatingWindow ? "Fenêtre Repas active" : "Période de Jeûne active"}
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                {fastingState.label}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Daily Micro-task Card */}
      {featureMicroTasksActive && dailyTask && (
        <Card className="border border-border bg-card shadow-xs">
          <CardHeader className="p-4 flex flex-row items-center gap-3 space-y-0 pb-2">
            <CheckSquare className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base font-serif font-semibold">Micro-tâche du jour</CardTitle>
              <CardDescription className="text-[10px]">Un défi simple et comportemental pour aujourd'hui</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-3">
            <p className="text-sm text-foreground/90 font-serif leading-relaxed">
              {dailyTask.text}
            </p>
            
            {taskCompleted ? (
              <div className="flex items-center gap-2 text-xs font-semibold text-green-600 dark:text-green-400 bg-green-500/10 p-2 rounded-md border border-green-500/20">
                <CheckSquare className="h-4 w-4 text-green-600 dark:text-green-400" /> Tâche complétée avec succès !
              </div>
            ) : (
              <Button 
                onClick={handleCompleteTask} 
                variant="outline" 
                size="sm"
                className="w-full text-xs h-9 border-primary/20 text-primary hover:bg-primary/5"
              >
                Marquer comme résolue
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      </div>
      {/* /Top status row */}

      {/* Main row : chart 2/3 + progress 1/3 on lg */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Weight Chart Card */}
        <div className="space-y-2 lg:col-span-2">
          <h3 className="text-lg font-serif font-semibold text-foreground px-1">Suivi du Poids Moyen Glissant</h3>
          <WeightChart data={chartData} />
          <p className="text-[10px] text-muted-foreground px-1 text-center">
            La courbe sombre représente la moyenne glissante (7j) pour lisser les fluctuations d'eau.
          </p>
        </div>

        {/* Progress metrics */}
        <Card className="border border-border bg-card shadow-xs lg:col-span-1">
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
      </div>

      {/* Quick Actions — wider grid on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pb-4">
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
        <Button
          variant="outline"
          onClick={() => router.push("/progress")}
          className="hidden lg:flex flex-col items-center justify-center gap-1 h-16 rounded-xl text-xs font-semibold"
        >
          <TrendingUp className="h-4 w-4 text-primary" /> Suivi détaillé
        </Button>
        <Button
          variant="outline"
          onClick={() => router.push("/plan")}
          className="hidden lg:flex flex-col items-center justify-center gap-1 h-16 rounded-xl text-xs font-semibold"
        >
          <Trophy className="h-4 w-4 text-primary" /> Plan complet
        </Button>
      </div>
    </div>
  );
}
