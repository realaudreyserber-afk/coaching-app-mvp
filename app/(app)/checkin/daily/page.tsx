/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/firebase/hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function DailyCheckinPage() {
  const { user, getFreshToken } = useAuth();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  
  // Daily checkin form state
  const [weight, setWeight] = useState("");
  const [sleep, setSleep] = useState(7);
  const [sleepQuality, setSleepQuality] = useState(5);
  const [energy, setEnergy] = useState(5);
  const [hunger, setHunger] = useState(5);
  const [mood, setMood] = useState(5);
  const [adherence, setAdherence] = useState(100);
  const [trainingDone, setTrainingDone] = useState(false);
  const [steps, setSteps] = useState("");
  const [notes, setNotes] = useState("");

  // AI Insight response state
  const [aiInsight, setAiInsight] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const wNum = parseFloat(weight);
    if (isNaN(wNum) || wNum < 30 || wNum > 250) {
      return setError("S'il te plaît, spécifie un poids valide.");
    }

    const stepsNum = parseInt(steps, 10);
    if (isNaN(stepsNum) || stepsNum < 0) {
      return setError("S'il te plaît, indique un nombre de pas valide.");
    }

    setSubmitting(true);
    setError("");

    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const checkinRef = doc(db, "users", user.uid, "checkins_daily", todayStr);

      const payload = {
        weight: wNum,
        sleep_hours: Number(sleep),
        sleep_quality: Number(sleepQuality),
        energy: Number(energy),
        hunger: Number(hunger),
        mood: Number(mood),
        adherence_nutrition: Number(adherence),
        training_done: trainingDone,
        steps: stepsNum,
        notes: notes.trim(),
        created_at: new Date().toISOString(),
      };

      // 1. Save check-in details to Firestore
      await setDoc(checkinRef, payload);

      // 2. Fetch daily insight from API
      const token = await getFreshToken();
      if (token) {
        try {
          const res = await fetch("/api/ai/daily-insight", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ checkin: payload }),
          });

          if (res.ok) {
            const data = await res.json();
            setAiInsight(data?.insight || "Super boulot pour ton bilan du jour ! Reste constant.");
          }
        } catch (apiErr) {
          console.error("AI Insight failed, falling back:", apiErr);
          setAiInsight("Bilan quotidien enregistré. Continue sur cette voie !");
        }
      }

    } catch (err: any) {
      console.error(err);
      setError("Impossible d'enregistrer le bilan. Réessaie.");
      setSubmitting(false);
    }
  };

  if (aiInsight) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center py-10 px-4 bg-cream dark:bg-anthracite">
        <Card className="max-w-md w-full border-border">
          <CardHeader className="text-center space-y-2">
            <span className="text-3xl">✨</span>
            <CardTitle className="text-2xl font-serif">L'insight du jour</CardTitle>
            <CardDescription>Ton retour personnalisé instantané</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-lg leading-relaxed text-foreground font-serif italic text-center px-2 py-4 bg-orange-light/40 rounded-lg border border-orange-light dark:bg-primary/10 dark:border-primary/20">
              "{aiInsight}"
            </p>
            <Button onClick={() => router.push("/dashboard")} className="w-full h-11">
              Aller au Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col justify-center items-center py-10 px-4 bg-cream dark:bg-anthracite">
      <Card className="max-w-md w-full border-border">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-3xl font-serif">Bilan Quotidien</CardTitle>
          <CardDescription>
            Saisis tes indicateurs pour rester aligné avec ton plan. (Prend ~30s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Weight & Steps in Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Poids (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="ex: 78.2"
                  className="w-full h-11 px-3 rounded-md border border-border bg-transparent focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Nombre de pas</label>
                <input
                  type="number"
                  required
                  value={steps}
                  onChange={(e) => setSteps(e.target.value)}
                  placeholder="ex: 8500"
                  className="w-full h-11 px-3 rounded-md border border-border bg-transparent focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {/* Sliders for Energy, Hunger, Sleep, Mood */}
            <div className="space-y-4">
              <div className="space-y-1">
                <div className="flex justify-between text-sm font-medium">
                  <span>Sommeil</span>
                  <span className="text-xs text-muted-foreground">{sleep} h (Qualité: {sleepQuality}/10)</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs">Durée</span>
                    <input
                      type="range"
                      min="4"
                      max="12"
                      step="0.5"
                      value={sleep}
                      onChange={(e) => setSleep(parseFloat(e.target.value))}
                      className="w-full accent-primary"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs">Qualité</span>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={sleepQuality}
                      onChange={(e) => setSleepQuality(parseInt(e.target.value))}
                      className="w-full accent-primary"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-sm font-medium">
                  <span>Niveau d'énergie</span>
                  <span className="text-xs text-primary">{energy}/10</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={energy}
                  onChange={(e) => setEnergy(parseInt(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-sm font-medium">
                  <span>Niveau de faim</span>
                  <span className="text-xs text-primary">{hunger}/10</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={hunger}
                  onChange={(e) => setHunger(parseInt(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-sm font-medium">
                  <span>Humeur générale</span>
                  <span className="text-xs text-primary">{mood}/10</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={mood}
                  onChange={(e) => setMood(parseInt(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-sm font-medium">
                  <span>Adhérence repas</span>
                  <span className="text-xs text-primary">{adherence}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="10"
                  value={adherence}
                  onChange={(e) => setAdherence(parseInt(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
            </div>

            {/* Training Checkbox Toggle */}
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-md border border-border">
              <input
                type="checkbox"
                id="trainingDone"
                checked={trainingDone}
                onChange={(e) => setTrainingDone(e.target.checked)}
                className="h-5 w-5 rounded border-border text-primary accent-primary"
              />
              <label htmlFor="trainingDone" className="text-sm font-medium select-none cursor-pointer">
                J'ai validé ma séance d'entraînement aujourd'hui
              </label>
            </div>

            {/* Free Notes */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Notes libres (facultatif)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ressentis physiques, digestion, écarts, stress..."
                className="w-full h-20 p-3 rounded-md border border-border bg-transparent focus:outline-none focus:ring-1 focus:ring-primary text-sm resize-none"
              />
            </div>

            {error && <p className="text-sm text-red-500 font-medium">{error}</p>}

            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/dashboard")}
                className="w-1/3 h-11"
              >
                Annuler
              </Button>
              <Button type="submit" disabled={submitting} className="w-2/3 h-11">
                {submitting ? "Enregistrement..." : "Valider mon bilan"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
