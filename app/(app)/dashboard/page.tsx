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
import { Loader } from "@/components/ui/loader";
import { KPICard } from "@/components/ui/kpi-card";
import { RadialProgress } from "@/components/ui/radial-progress";
import { Calendar, MessageSquare, TrendingUp, Sparkles, Plus, Clock, CheckSquare, Trophy, Scale, Flame, Award } from "lucide-react";
import { HudCard, PanelHeader, Tag } from "@/components/nodream";
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
  // Wave 6C : badge si ORACLE.IA a posté un message proactif non-lu
  const [coachUnread, setCoachUnread] = useState(false);

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

          // Wave 6C : badge si ORACLE.IA a une intervention proactive non-lue
          try {
            const coachStateRef = doc(db, "users", user.uid, "coach_state", "main");
            const coachStateSnap = await getDoc(coachStateRef);
            if (coachStateSnap.exists() && coachStateSnap.data()?.has_unread_intervention === true) {
              setCoachUnread(true);
            }
          } catch (e) {
            console.warn("[dashboard] coach_state read failed:", e);
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
    return <Loader size="fullscreen" message="Ouverture de ton espace..." />;
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
      {/* Tactical Greeting */}
      <div className="space-y-2">
        <div className="flex justify-between items-end gap-4 flex-wrap">
          <div>
            <span
              className="mono"
              style={{
                fontSize: 10,
                letterSpacing: '0.3em',
                color: 'var(--accent-tech)',
                opacity: 0.85,
              }}
            >
              [SUJ-{user?.uid?.slice(0, 6).toUpperCase() ?? "------"}] · IDENTIFIÉ
            </span>
            <h2
              style={{
                fontFamily: 'var(--font-sans)',
                fontWeight: 900,
                fontSize: 'var(--type-h1)',
                letterSpacing: 'var(--tracking-display)',
                lineHeight: 1.05,
                color: 'var(--fg-1)',
                marginTop: 4,
              }}
            >
              Humain <span style={{ color: 'var(--gold-400)' }}>{profile?.name || 'athlète'}</span>.
            </h2>
            <p
              className="mono"
              style={{
                marginTop: 6,
                fontSize: 'var(--type-meta)',
                letterSpacing: '0.18em',
                color: 'var(--fg-4)',
                textTransform: 'uppercase',
              }}
            >
              État de la transformation · Aujourd'hui
            </p>
          </div>
          {featureStreakActive && streak && streak.current > 0 && (
            <Tag accent="gold">
              <Award className="h-3 w-3" aria-hidden="true" />
              <span className="tabular-nums">{streak.current}</span>
              <span>{streak.current === 1 ? 'jour' : 'jours'}</span>
            </Tag>
          )}
        </div>
      </div>

      {/* KPI Row — 3 metrics on desktop, stacked on mobile */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KPICard
          label="Poids actuel"
          value={currentWeight.toFixed(1)}
          unit="kg"
          delta={parseFloat(deltaPoids.toFixed(1))}
          deltaUnit="kg"
          deltaLabel="depuis le départ"
          deltaDirection={targetDelta < 0 ? "down-good" : "up-good"}
          icon={Scale}
          variant="gold"
        />
        <KPICard
          label="Objectif poids"
          value={targetWeight || "—"}
          unit={targetWeight ? "kg" : undefined}
          delta={parseFloat((targetWeight - currentWeight).toFixed(1))}
          deltaUnit="kg"
          deltaLabel="restant"
          deltaDirection={targetDelta < 0 ? "down-good" : "up-good"}
          icon={Trophy}
        />
        {featureStreakActive && streak ? (
          <KPICard
            label="Série"
            value={streak.current || 0}
            unit={streak.current === 1 ? "jour" : "jours"}
            delta={streak.best ? streak.current - streak.best : undefined}
            deltaLabel={streak.best ? `record : ${streak.best}` : undefined}
            deltaDirection="up-good"
            icon={Flame}
          />
        ) : (
          <KPICard
            label="Progression"
            value={progressPercentage}
            unit="%"
            deltaLabel="vers ton objectif"
            icon={TrendingUp}
          />
        )}
      </div>

      {/* Top status row : checkin / fasting / micro-task — grid up to 3 cols on lg */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {/* Daily Checkin Status Card */}
      {!todayCheckin ? (
        <HudCard accent="gold" chamfer="sm" style={{ padding: '1rem 1.25rem' }}>
          <PanelHeader
            code="ORDRE-DU-JOUR"
            title="Bilan incomplet"
            accent="gold"
          />
          <p style={{ fontSize: 'var(--type-body-sm)', color: 'var(--fg-3)', margin: '0 0 12px 0' }}>
            30 secondes pour enregistrer tes indicateurs et ton poids. Sans données, pas de recalibrage.
          </p>
          <button
            onClick={() => router.push("/checkin/daily")}
            className="btn btn-primary"
            style={{ width: '100%' }}
          >
            <Plus className="h-4 w-4" /> Exécuter le check-in
          </button>
        </HudCard>
      ) : (
        <HudCard accent="tech" chamfer="sm" style={{ padding: '1rem 1.25rem' }}>
          <PanelHeader
            code="ORACLE.IA · BRIEFING"
            title={
              <span className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" style={{ color: 'var(--accent-tech)' }} />
                Insight du jour
              </span>
            }
            accent="tech"
          />
          <p
            style={{
              fontSize: 'var(--type-body)',
              fontFamily: 'var(--font-serif)',
              fontStyle: 'italic',
              lineHeight: 1.6,
              color: 'var(--fg-2)',
              margin: 0,
            }}
          >
            {aiInsight ? `"${aiInsight}"` : "Recalibrage en cours du module narratif..."}
          </p>
        </HudCard>
      )}

      {/* Fasting Protocol Status Card */}
      {featureFastingActive && fastingState && (
        <HudCard accent="gold" chamfer="sm" style={{ padding: '1rem 1.25rem' }}>
          <PanelHeader
            code="JEÛNE-IF"
            title={
              <span className="flex items-center gap-2">
                <Clock className="h-4 w-4" style={{ color: 'var(--gold-400)' }} />
                Protocole de jeûne
              </span>
            }
            accent="gold"
          />
          <div className="flex items-center justify-between gap-3">
            <Tag accent={fastingState.isEatingWindow ? "tech" : "gold"}>
              {fastingState.isEatingWindow ? "Fenêtre repas active" : "Période de jeûne active"}
            </Tag>
            <span
              className="mono"
              style={{
                fontSize: 11,
                color: 'var(--fg-4)',
                letterSpacing: '0.1em',
              }}
            >
              {fastingState.label}
            </span>
          </div>
        </HudCard>
      )}

      {/* Daily Micro-task Card */}
      {featureMicroTasksActive && dailyTask && (
        <HudCard accent="gold" chamfer="sm" style={{ padding: '1rem 1.25rem' }}>
          <PanelHeader
            code="MIS-MICRO"
            title={
              <span className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4" style={{ color: 'var(--gold-400)' }} />
                Micro-tâche
              </span>
            }
            accent="gold"
          />
          <div className="space-y-3">
            <p
              style={{
                fontSize: 'var(--type-body)',
                color: 'var(--fg-2)',
                lineHeight: 1.55,
                margin: 0,
              }}
            >
              {dailyTask.text}
            </p>
            
            {taskCompleted ? (
              <Tag accent="tech">
                <CheckSquare className="h-3 w-3" /> Résolue
              </Tag>
            ) : (
              <button
                onClick={handleCompleteTask}
                className="btn btn-tech"
                style={{ width: '100%' }}
              >
                Marquer comme résolue
              </button>
            )}
          </div>
        </HudCard>
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

        {/* Progress metrics — radial + steps */}
        <HudCard accent="gold" chamfer="sm" className="lg:col-span-1" style={{ padding: '1rem 1.25rem' }}>
          <PanelHeader
            code="OBJ-TRANSFO"
            title={
              <span className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" style={{ color: 'var(--gold-400)' }} /> Objectif
              </span>
            }
            accent="gold"
          />
          <div className="flex justify-center mb-4">
            <RadialProgress
              value={progressPercentage}
              subLabel={progressPercentage >= 100 ? "atteint" : "complet"}
              size={140}
              strokeWidth={10}
            />
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div
              style={{
                padding: 8,
                background: 'var(--glass-bg-2)',
                border: '1px solid var(--glass-border)',
                clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)',
              }}
            >
              <span className="eyebrow" style={{ color: 'var(--fg-4)' }}>Départ</span>
              <div className="mono" style={{ fontSize: 14, color: 'var(--fg-2)', fontWeight: 700, marginTop: 2 }}>
                {startWeight} <span style={{ fontSize: 9, color: 'var(--fg-5)' }}>kg</span>
              </div>
            </div>
            <div
              style={{
                padding: 8,
                background: 'var(--gold-tint-08)',
                border: '1px solid var(--gold-tint-25)',
                clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)',
              }}
            >
              <span className="eyebrow">Actuel</span>
              <div className="mono" style={{ fontSize: 14, color: 'var(--gold-400)', fontWeight: 700, marginTop: 2 }}>
                {currentWeight} <span style={{ fontSize: 9, color: 'var(--fg-5)' }}>kg</span>
              </div>
            </div>
            <div
              style={{
                padding: 8,
                background: 'var(--glass-bg-2)',
                border: '1px solid var(--glass-border)',
                clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)',
              }}
            >
              <span className="eyebrow" style={{ color: 'var(--fg-4)' }}>Objectif</span>
              <div className="mono" style={{ fontSize: 14, color: 'var(--fg-2)', fontWeight: 700, marginTop: 2 }}>
                {targetWeight || "—"} {targetWeight && <span style={{ fontSize: 9, color: 'var(--fg-5)' }}>kg</span>}
              </div>
            </div>
          </div>
        </HudCard>
      </div>

      {/* Quick Actions — wider grid on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pb-4">
        <Button
          variant="outline"
          onClick={() => router.push("/coach")}
          className="flex flex-col items-center justify-center gap-1 h-16 rounded-xl text-xs font-semibold"
        >
          <MessageSquare className="h-4 w-4 text-primary" /> Parler au Coach IA
          {coachUnread && (
            <span
              aria-label="Nouveau message ORACLE.IA"
              style={{
                marginLeft: 6,
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "var(--accent-tech)",
                boxShadow: "0 0 8px var(--accent-tech)",
                display: "inline-block",
              }}
            />
          )}
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
