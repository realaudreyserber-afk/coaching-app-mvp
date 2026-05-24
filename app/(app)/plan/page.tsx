/* eslint-disable react/no-unescaped-entities */
"use client";

import React, { useEffect, useState } from "react";
import { collection, query, where, limit, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/firebase/hooks";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { PlanDoc } from "@/types/plan";
import { Flame, Dumbbell, ShieldCheck, Apple, Calendar } from "lucide-react";

export default function PlanPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"nutrition" | "training">("nutrition");
  const [plan, setPlan] = useState<PlanDoc | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (loading || !user) return;

    const fetchActivePlan = async () => {
      try {
        const plansRef = collection(db, "users", user.uid, "plans");
        const plansQuery = query(plansRef, where("active", "==", true), limit(1));
        const snap = await getDocs(plansQuery);

        if (!snap.empty) {
          setPlan({ id: snap.docs[0].id, ...snap.docs[0].data() } as PlanDoc);
        }
        setFetching(false);
      } catch (err) {
        console.error("Error loading active plan:", err);
        setFetching(false);
      }
    };

    fetchActivePlan();
  }, [user, loading]);

  if (loading || fetching) {
    return (
      <div className="flex-1 flex items-center justify-center bg-cream px-4 dark:bg-anthracite">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-sm text-muted-foreground font-serif">Chargement de ton plan d'action...</p>
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center py-10 px-6 bg-cream dark:bg-anthracite text-center space-y-6">
        <Card className="max-w-md w-full border-border">
          <CardHeader className="space-y-2">
            <span className="text-4xl">📋</span>
            <CardTitle className="text-2xl font-serif">Aucun plan actif</CardTitle>
            <CardDescription>
              Tu dois d'abord compléter ton onboarding pour que le coach IA génère ton plan personnalisé.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/onboarding")} className="w-full h-11">
              Démarrer l'onboarding
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 max-w-md w-full mx-auto px-4 py-6 space-y-6">
      <div>
        <h2 className="text-3xl font-bold font-serif text-foreground">Ton plan de transformation</h2>
        <p className="text-sm text-muted-foreground">
          Calibré par l'IA le {plan.date_start ? new Date(plan.date_start).toLocaleDateString("fr-FR") : "récemment"}.
        </p>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-lg border border-border">
        <button
          onClick={() => setActiveTab("nutrition")}
          className={`py-2 px-3 rounded-md text-xs font-semibold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
            activeTab === "nutrition"
              ? "bg-card text-primary shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Apple className="h-4 w-4" /> Nutrition
        </button>
        <button
          onClick={() => setActiveTab("training")}
          className={`py-2 px-3 rounded-md text-xs font-semibold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
            activeTab === "training"
              ? "bg-card text-primary shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Dumbbell className="h-4 w-4" /> Entraînement
        </button>
      </div>

      {/* NUTRITION TAB */}
      {activeTab === "nutrition" && (
        <div className="space-y-6">
          {/* Calorie & Macro Target Card */}
          <Card className="border border-border bg-card shadow-xs">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base font-serif font-semibold flex items-center gap-2">
                <Flame className="h-4 w-4 text-primary" /> Objectif Énergétique
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-4">
              <div className="bg-primary/5 p-3 rounded-lg border border-primary/20 text-center">
                <span className="text-[10px] uppercase text-primary block tracking-wider font-semibold">Cible Journalière</span>
                <span className="text-2xl font-bold text-primary font-serif">{plan.kcal} kcal</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs font-medium">
                <div className="bg-muted p-2 rounded-md">
                  <span className="text-[9px] uppercase text-muted-foreground block">Protéines</span>
                  <span className="text-sm font-bold text-foreground">{plan.macros.p} g</span>
                </div>
                <div className="bg-muted p-2 rounded-md">
                  <span className="text-[9px] uppercase text-muted-foreground block">Glucides</span>
                  <span className="text-sm font-bold text-foreground">{plan.macros.c} g</span>
                </div>
                <div className="bg-muted p-2 rounded-md">
                  <span className="text-[9px] uppercase text-muted-foreground block">Lipides</span>
                  <span className="text-sm font-bold text-foreground">{plan.macros.f} g</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Meals Template */}
          <div className="space-y-3">
            <h3 className="text-lg font-serif font-semibold text-foreground px-1">Exemple de journée type</h3>
            <div className="space-y-3">
              {plan.meals_template.map((meal, idx) => (
                <Card key={idx} className="border border-border/80 bg-card/65">
                  <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-sm font-serif font-bold text-secondary">{meal.name}</CardTitle>
                    <span className="text-xs font-semibold px-2 py-0.5 bg-muted rounded-full text-muted-foreground">
                      ~{meal.approx_kcal} kcal
                    </span>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <p className="text-xs text-muted-foreground leading-relaxed">{meal.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Supplements List */}
          {plan.supplements && plan.supplements.length > 0 && (
            <Card className="border border-border bg-card">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-base font-serif font-semibold">Compléments suggérés</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <ul className="space-y-2 text-xs">
                  {plan.supplements.map((sup, idx) => (
                    <li key={idx} className="flex justify-between items-center py-1.5 border-b border-border last:border-0">
                      <div>
                        <strong className="text-foreground">{sup.name}</strong>
                        <span className="text-muted-foreground block text-[10px]">{sup.timing}</span>
                      </div>
                      <span className="font-semibold text-primary">{sup.dosage}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* TRAINING TAB */}
      {activeTab === "training" && (
        <div className="space-y-6">
          {/* Workouts Splits */}
          <div className="space-y-4">
            <h3 className="text-lg font-serif font-semibold text-foreground px-1">Programme sportif</h3>
            <div className="space-y-4">
              {plan.training.sessions.map((session, sIdx) => (
                <Card key={sIdx} className="border border-border bg-card">
                  <CardHeader className="p-4 pb-2 bg-muted/40 border-b border-border/40">
                    <CardTitle className="text-base font-serif font-bold text-foreground">{session.name}</CardTitle>
                    <CardDescription className="text-xs">
                      Fréquence recommandée : {session.frequency_weekly}x par semaine
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-border">
                      {session.exercises.map((ex, eIdx) => (
                        <div key={eIdx} className="p-3 flex items-center justify-between text-xs hover:bg-muted/10 transition-all">
                          <div className="max-w-[65%]">
                            <span className="font-semibold text-foreground block">{ex.name}</span>
                            <span className="text-muted-foreground text-[10px]">Repos : {ex.rest_seconds}s</span>
                          </div>
                          <span className="font-bold text-primary text-sm whitespace-nowrap">
                            {ex.sets} x {ex.reps}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Cardio Split */}
          {plan.cardio && (
            <Card className="border border-border bg-card">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-base font-serif font-semibold flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" /> Travail Cardiovasculaire
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 text-xs space-y-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-muted p-2 rounded-md text-center">
                    <span className="text-[10px] text-muted-foreground block">Type</span>
                    <strong className="text-foreground">{plan.cardio.type}</strong>
                  </div>
                  <div className="bg-muted p-2 rounded-md text-center">
                    <span className="text-[10px] text-muted-foreground block">Intensité</span>
                    <strong className="text-primary capitalize">{plan.cardio.intensity}</strong>
                  </div>
                </div>
                <p className="text-center text-muted-foreground mt-2">
                  Fais {plan.cardio.frequency_weekly} session(s) de {plan.cardio.duration_minutes} minutes par semaine.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Justification / Strategy Card */}
      {plan.justification && (
        <Card className="border border-border bg-orange-light/25 dark:bg-primary/5">
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-base font-serif font-semibold flex items-center gap-2 text-primary">
              <ShieldCheck className="h-4 w-4 text-primary" /> Justification du Coach
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <p className="text-xs leading-relaxed text-foreground font-serif italic">
              {plan.justification}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
