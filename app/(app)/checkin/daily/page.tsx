/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { doc, setDoc, collection, getDocs, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/firebase/hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { flags } from "@/lib/features/flags";
import { calculateStreak } from "@/lib/features/streak/streak-service";

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
  // Phase 6 data-layer : cravings granulaires
  const [cravingsTypes, setCravingsTypes] = useState<string[]>([]);
  const [cravingsIntensity, setCravingsIntensity] = useState(0);
  const [cravingsTrigger, setCravingsTrigger] = useState("");

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
        // Audit 2026-05-28 #7 : le champ `date` n'était JAMAIS écrit (seul le
        // doc-id valait le jour). Or weekly-review, cravings/store et l'alerte
        // humeur filtrent/trient sur `date` → Firestore exclut SILENCIEUSEMENT
        // les docs sans ce champ : bilan hebdo vide, cravings snapshot null,
        // alerte humeur jamais déclenchée. On l'écrit désormais explicitement.
        date: todayStr,
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
        // Phase 6 data-layer : cravings granulaires (sucré/salé/gras/etc.)
        cravings_types: cravingsTypes,
        cravings_intensity: Number(cravingsIntensity),
        cravings_trigger: cravingsTrigger.trim().slice(0, 200),
        created_at: new Date().toISOString(),
      };

      // 1. Save check-in details to Firestore
      await setDoc(checkinRef, payload);

      // 1.5 Calculate and save streak if feature_streak is active
      if (flags.streak()) {
        try {
          const checkinsRef = collection(db, "users", user.uid, "checkins_daily");
          const checkinsSnap = await getDocs(checkinsRef);
          const dates = [todayStr];
          checkinsSnap.forEach((doc) => {
            if (doc.id !== todayStr) {
              dates.push(doc.id);
            }
          });

          const { currentStreak, longestStreak } = calculateStreak(dates, todayStr);
          
          const userRef = doc(db, "users", user.uid);
          await updateDoc(userRef, {
            streak: {
              current: currentStreak,
              longest: longestStreak,
              lastCheckinDate: todayStr,
            }
          });
        } catch (streakErr) {
          console.error("Failed to update check-in streak:", streakErr);
        }
      }

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
      <div className="flex-1 flex flex-col justify-center items-center py-10 px-4 bg-background">
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
    <div className="flex-1 flex flex-col justify-center items-center py-10 px-4 bg-background">
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

            {/* Cravings — Phase 6 data-layer */}
            <div className="space-y-2 p-3 bg-muted/30 rounded-md border border-border">
              <div className="text-sm font-medium">Cravings aujourd'hui (facultatif)</div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { key: 'sweet', label: 'Sucré' },
                  { key: 'salty', label: 'Salé' },
                  { key: 'fatty', label: 'Gras' },
                  { key: 'caffeine', label: 'Caféine' },
                  { key: 'alcohol', label: 'Alcool' },
                  { key: 'specific_food', label: 'Aliment précis' },
                ].map((c) => {
                  const active = cravingsTypes.includes(c.key);
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => {
                        const s = new Set(cravingsTypes);
                        if (active) s.delete(c.key);
                        else s.add(c.key);
                        setCravingsTypes(Array.from(s));
                      }}
                      className={`px-2 py-1 rounded-full text-xs border ${
                        active
                          ? 'bg-amber-100 border-amber-400 text-amber-800'
                          : 'bg-transparent border-border text-muted-foreground'
                      }`}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
              {cravingsTypes.length > 0 && (
                <>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>Intensité</span>
                      <span className="text-primary">{cravingsIntensity}/10</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="10"
                      value={cravingsIntensity}
                      onChange={(e) => setCravingsIntensity(parseInt(e.target.value))}
                      className="w-full accent-primary"
                    />
                  </div>
                  <input
                    type="text"
                    value={cravingsTrigger}
                    onChange={(e) => setCravingsTrigger(e.target.value)}
                    placeholder="Déclencheur ? (ex: stress travail, soir après dîner, après séance)"
                    maxLength={200}
                    className="w-full p-2 rounded-md border border-border bg-transparent focus:outline-none focus:ring-1 focus:ring-primary text-xs"
                  />
                </>
              )}
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
