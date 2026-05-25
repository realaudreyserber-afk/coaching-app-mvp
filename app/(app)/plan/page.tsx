/* eslint-disable react/no-unescaped-entities */
"use client";

import { Loader } from "@/components/ui/loader";
import React, { useEffect, useState } from "react";
import { collection, query, where, limit, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/firebase/hooks";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { PlanDoc } from "@/types/plan";
import { Flame, Dumbbell, ShieldCheck, Apple, Calendar, Scale, ChevronDown, ChevronUp, Plus, Trash2, Pill } from "lucide-react";
import { groupSupplementsByMeal } from "@/lib/features/plans/group-supplements";
import { MealCard } from "@/components/plan/meal-card";
import { MacroBar } from "@/components/plan/macro-bar";
import { ExerciseCard } from "@/components/plan/exercise-card";

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
      <Loader size="fullscreen" message="Chargement de ton plan d'action..." />
    );
  }

  if (!plan) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center py-10 px-6 bg-background text-center space-y-6">
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
    <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10 space-y-6 lg:space-y-8">
      <div>
        <h2 className="text-3xl lg:text-4xl font-bold font-serif text-foreground">Ton plan de transformation</h2>
        <p className="text-sm text-muted-foreground">
          Calibré par l'IA le {plan.date_start ? new Date(plan.date_start).toLocaleDateString("fr-FR") : "récemment"}.
        </p>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-lg border border-border max-w-md">
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
        <div className="grid gap-6 lg:grid-cols-3 lg:gap-8">
          {/* LEFT: cible + calculateur (sticky on desktop) */}
          <div className="space-y-6 lg:col-span-1 lg:sticky lg:top-6 lg:self-start">
            <Card className="border border-zinc-800 bg-zinc-900 shadow-xs">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-base font-serif font-semibold flex items-center gap-2 text-zinc-50">
                  <Flame className="h-4 w-4 text-amber-500" aria-hidden="true" /> Objectif du jour
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-5">
                {/* Kcal cible — gros chiffre centré */}
                <div className="text-center py-3 px-2 rounded-lg border border-amber-500/30 bg-amber-500/5">
                  <span className="text-[10px] uppercase text-amber-400 block tracking-widest font-semibold">
                    Cible quotidienne
                  </span>
                  <div className="mt-1 flex items-baseline justify-center gap-1">
                    <span className="text-3xl font-bold text-amber-400 font-serif tabular-nums">
                      {plan.kcal}
                    </span>
                    <span className="text-sm text-amber-400/80">kcal</span>
                  </div>
                </div>

                {/* Macros cibles (consommation jour à venir Phase 2) */}
                <div className="space-y-3">
                  <MacroBar label="Protéines" value={plan.macros.p} />
                  <MacroBar label="Glucides" value={plan.macros.c} />
                  <MacroBar label="Lipides" value={plan.macros.f} />
                </div>
                <p className="text-[10px] text-zinc-500 leading-relaxed">
                  Valeurs cibles du plan. La consommation réelle s&apos;affichera ici
                  une fois ton bilan du jour validé.
                </p>
              </CardContent>
            </Card>

            <MealCalculator planKcal={plan.kcal} planMacros={plan.macros} />
          </div>

          {/* RIGHT: repas (grille de cartes sur desktop) */}
          <div className="space-y-4 lg:col-span-2">
            <h3 className="text-lg lg:text-xl font-serif font-semibold text-zinc-50 px-1">
              Suggestions de repas
            </h3>
            {(() => {
              const grouped = groupSupplementsByMeal(plan.meals_template, plan.supplements);
              return (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {grouped.meals.map((meal, idx) => (
                      <MealCard
                        key={idx}
                        meal={{
                          name: meal.name,
                          description: meal.description,
                          approxKcal: meal.approx_kcal,
                          supplements: meal.supplements,
                        }}
                      />
                    ))}
                  </div>

                  {grouped.orphans.length > 0 && (
                    <Card className="border border-zinc-800 bg-zinc-900">
                      <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-sm font-serif font-bold text-zinc-50 flex items-center gap-1.5">
                          <Pill className="h-4 w-4 text-amber-500" aria-hidden="true" />
                          Compléments hors repas
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <ul className="space-y-1.5 text-xs">
                          {grouped.orphans.map((sup, idx) => (
                            <li
                              key={idx}
                              className="flex justify-between items-start py-2 border-b border-zinc-800 last:border-0"
                            >
                              <div>
                                <strong className="text-zinc-100">{sup.name}</strong>
                                <span className="text-zinc-400 block text-[10px] mt-0.5">{sup.timing}</span>
                              </div>
                              <span className="font-semibold text-amber-400 tabular-nums">{sup.dosage}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* TRAINING TAB */}
      {activeTab === "training" && (
        <div className="grid gap-6 lg:grid-cols-3 lg:gap-8">
          {/* LEFT: programme (col-span-2) */}
          <div className="space-y-6 lg:col-span-2">
            <h3 className="text-lg lg:text-xl font-serif font-semibold text-zinc-50 px-1">
              Programme sportif
            </h3>
            {plan.training.sessions.map((session, sIdx) => (
              <section key={sIdx} className="space-y-3">
                <div className="flex items-baseline justify-between px-1">
                  <h4 className="text-base font-serif font-bold text-zinc-50">
                    {session.name}
                  </h4>
                  <span className="text-xs text-zinc-400">
                    <span className="text-amber-400 font-semibold tabular-nums">
                      {session.frequency_weekly}×
                    </span>{" "}
                    / semaine
                  </span>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {session.exercises.map((ex, eIdx) => (
                    <ExerciseCard
                      key={eIdx}
                      index={eIdx + 1}
                      exercise={{
                        name: ex.name,
                        sets: ex.sets,
                        reps: ex.reps,
                        restSeconds: ex.rest_seconds,
                      }}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>

          {/* RIGHT: cardio (col-span-1, sticky) */}
          {plan.cardio && (
            <div className="lg:col-span-1 lg:sticky lg:top-6 lg:self-start">
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
            </div>
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

// ==========================================
// FOOD DATABASE & MEAL CALCULATOR COMPONENT
// ==========================================

interface FoodItem {
  id: string;
  name: string;
  category: "carb" | "protein" | "fat" | "other";
  raw: {
    kcal: number;
    p: number;
    c: number;
    f: number;
  };
  cooked?: {
    kcal: number;
    p: number;
    c: number;
    f: number;
  };
  coeffRawToCooked?: number;
  unit?: string;
}

const FOOD_DATABASE: FoodItem[] = [
  {
    id: "riz",
    name: "Riz blanc (Riz)",
    category: "carb",
    raw: { kcal: 360, p: 7.5, c: 79, f: 0.5 },
    cooked: { kcal: 144, p: 3, c: 31.6, f: 0.2 },
    coeffRawToCooked: 2.5
  },
  {
    id: "pates",
    name: "Pâtes blanches",
    category: "carb",
    raw: { kcal: 350, p: 12, c: 70, f: 1.5 },
    cooked: { kcal: 140, p: 4.8, c: 28, f: 0.6 },
    coeffRawToCooked: 2.5
  },
  {
    id: "semoule",
    name: "Semoule de blé",
    category: "carb",
    raw: { kcal: 350, p: 12, c: 73, f: 1.5 },
    cooked: { kcal: 140, p: 4.8, c: 29.2, f: 0.6 },
    coeffRawToCooked: 2.5
  },
  {
    id: "patate",
    name: "Pomme de terre",
    category: "carb",
    raw: { kcal: 80, p: 2, c: 18, f: 0.1 },
    cooked: { kcal: 80, p: 2, c: 18, f: 0.1 },
    coeffRawToCooked: 1.0
  },
  {
    id: "patate_douce",
    name: "Patate douce",
    category: "carb",
    raw: { kcal: 86, p: 1.6, c: 20, f: 0.1 },
    cooked: { kcal: 86, p: 1.6, c: 20, f: 0.1 },
    coeffRawToCooked: 1.0
  },
  {
    id: "avoine",
    name: "Flocons d'avoine",
    category: "carb",
    raw: { kcal: 370, p: 13, c: 60, f: 7 },
    unit: "g"
  },
  {
    id: "poulet",
    name: "Blanc de poulet",
    category: "protein",
    raw: { kcal: 110, p: 23, c: 0, f: 1.5 },
    cooked: { kcal: 147, p: 31, c: 0, f: 2 },
    coeffRawToCooked: 0.75
  },
  {
    id: "steak5",
    name: "Steak haché 5%",
    category: "protein",
    raw: { kcal: 124, p: 21, c: 0, f: 5 },
    cooked: { kcal: 165, p: 28, c: 0, f: 6.7 },
    coeffRawToCooked: 0.75
  },
  {
    id: "saumon",
    name: "Pavé de saumon",
    category: "protein",
    raw: { kcal: 200, p: 20, c: 0, f: 13 },
    cooked: { kcal: 250, p: 25, c: 0, f: 16.3 },
    coeffRawToCooked: 0.8
  },
  {
    id: "cabillaud",
    name: "Cabillaud",
    category: "protein",
    raw: { kcal: 82, p: 18, c: 0, f: 0.7 },
    cooked: { kcal: 102, p: 22.5, c: 0, f: 0.9 },
    coeffRawToCooked: 0.8
  },
  {
    id: "oeuf",
    name: "Œuf entier",
    category: "protein",
    raw: { kcal: 75, p: 6.5, c: 0.5, f: 5 },
    unit: "unité"
  },
  {
    id: "huile_olive",
    name: "Huile d'olive",
    category: "fat",
    raw: { kcal: 90, p: 0, c: 0, f: 10 },
    unit: "g"
  },
  {
    id: "avocat",
    name: "Avocat",
    category: "fat",
    raw: { kcal: 160, p: 2, c: 9, f: 15 },
    unit: "g"
  }
];

interface CalculatorItem {
  id: string;
  foodId: string;
  weight: number;
  isCooked: boolean;
}

function MealCalculator({ planKcal, planMacros }: { planKcal: number; planMacros: { p: number; c: number; f: number } }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<"equiv" | "calc">("equiv");

  // State for Equivalences
  const [equivFoodId, setEquivFoodId] = useState(FOOD_DATABASE[0].id);
  const [equivRawWeight, setEquivRawWeight] = useState<string>("100");
  const [equivCookedWeight, setEquivCookedWeight] = useState<string>("250");
  const [lastEdited, setLastEdited] = useState<"raw" | "cooked">("raw");

  // State for Meal Builder
  const [items, setItems] = useState<CalculatorItem[]>([]);

  const selectedFood = FOOD_DATABASE.find(f => f.id === equivFoodId) || FOOD_DATABASE[0];

  const handleRawChange = (val: string) => {
    setEquivRawWeight(val);
    setLastEdited("raw");
    const num = parseFloat(val);
    if (!isNaN(num) && selectedFood.coeffRawToCooked) {
      setEquivCookedWeight((num * selectedFood.coeffRawToCooked).toFixed(0));
    } else {
      setEquivCookedWeight("");
    }
  };

  const handleCookedChange = (val: string) => {
    setEquivCookedWeight(val);
    setLastEdited("cooked");
    const num = parseFloat(val);
    if (!isNaN(num) && selectedFood.coeffRawToCooked) {
      setEquivRawWeight((num / selectedFood.coeffRawToCooked).toFixed(0));
    } else {
      setEquivRawWeight("");
    }
  };

  const handleFoodChange = (newFoodId: string) => {
    setEquivFoodId(newFoodId);
    const food = FOOD_DATABASE.find(f => f.id === newFoodId) || FOOD_DATABASE[0];
    if (food.coeffRawToCooked) {
      if (lastEdited === "raw") {
        const num = parseFloat(equivRawWeight);
        if (!isNaN(num)) {
          setEquivCookedWeight((num * food.coeffRawToCooked).toFixed(0));
        }
      } else {
        const num = parseFloat(equivCookedWeight);
        if (!isNaN(num)) {
          setEquivRawWeight((num / food.coeffRawToCooked).toFixed(0));
        }
      }
    } else {
      setEquivCookedWeight("");
    }
  };

  const getEquivMacros = () => {
    const rawNum = parseFloat(equivRawWeight);
    if (isNaN(rawNum)) return { kcal: 0, p: 0, c: 0, f: 0 };
    const factor = rawNum / 100;
    return {
      kcal: Math.round(selectedFood.raw.kcal * factor),
      p: parseFloat((selectedFood.raw.p * factor).toFixed(1)),
      c: parseFloat((selectedFood.raw.c * factor).toFixed(1)),
      f: parseFloat((selectedFood.raw.f * factor).toFixed(1))
    };
  };

  const equivMacros = getEquivMacros();

  const addItem = () => {
    const newItem: CalculatorItem = {
      id: Math.random().toString(36).substring(2, 9),
      foodId: FOOD_DATABASE[0].id,
      weight: 100,
      isCooked: false
    };
    setItems([...items, newItem]);
  };

  const updateItem = (id: string, fields: Partial<CalculatorItem>) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updated = { ...item, ...fields };
        const food = FOOD_DATABASE.find(f => f.id === updated.foodId);
        if (food && !food.cooked) {
          updated.isCooked = false;
        }
        return updated;
      }
      return item;
    }));
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const getTotals = () => {
    let kcal = 0, p = 0, c = 0, f = 0;
    items.forEach(item => {
      const food = FOOD_DATABASE.find(f => f.id === item.foodId);
      if (!food) return;
      const factor = item.weight / 100;
      if (item.isCooked && food.cooked) {
        kcal += food.cooked.kcal * factor;
        p += food.cooked.p * factor;
        c += food.cooked.c * factor;
        f += food.cooked.f * factor;
      } else {
        kcal += food.raw.kcal * factor;
        p += food.raw.p * factor;
        c += food.raw.c * factor;
        f += food.raw.f * factor;
      }
    });
    return {
      kcal: Math.round(kcal),
      p: parseFloat(p.toFixed(1)),
      c: parseFloat(c.toFixed(1)),
      f: parseFloat(f.toFixed(1))
    };
  };

  const totals = getTotals();

  return (
    <Card className="border border-border bg-card shadow-xs">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex items-center justify-between text-left font-serif font-semibold text-foreground cursor-pointer outline-hidden"
      >
        <span className="flex items-center gap-2 text-base">
          <Scale className="h-4 w-4 text-primary" /> Équivalences & Calories
        </span>
        {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {isOpen && (
        <CardContent className="p-4 pt-0 border-t border-border/50 space-y-4">
          <div className="flex gap-2 bg-muted/40 p-1 rounded-md border border-border mt-3">
            <button
              onClick={() => setActiveSubTab("equiv")}
              className={`flex-1 py-1.5 text-xs font-semibold text-center rounded-md cursor-pointer transition-all ${
                activeSubTab === "equiv" ? "bg-card text-primary shadow-xs" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Cru vs Cuit
            </button>
            <button
              onClick={() => setActiveSubTab("calc")}
              className={`flex-1 py-1.5 text-xs font-semibold text-center rounded-md cursor-pointer transition-all ${
                activeSubTab === "calc" ? "bg-card text-primary shadow-xs" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Calculateur de repas
            </button>
          </div>

          {activeSubTab === "equiv" && (
            <div className="space-y-4 pt-1">
              <div>
                <label className="text-[10px] uppercase font-semibold text-muted-foreground block mb-1">Aliment</label>
                <select
                  value={equivFoodId}
                  onChange={(e) => handleFoodChange(e.target.value)}
                  className="w-full h-10 rounded-md bg-card border border-border px-3 text-xs"
                >
                  {FOOD_DATABASE.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase font-semibold text-muted-foreground block mb-1">Poids Cru (g)</label>
                  <input
                    type="number"
                    value={equivRawWeight}
                    onChange={(e) => handleRawChange(e.target.value)}
                    className="w-full h-10 rounded-md bg-card border border-border px-3 text-xs"
                    placeholder="Ex: 100"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-semibold text-muted-foreground block mb-1">Poids Cuit (g)</label>
                  <input
                    type="number"
                    value={equivCookedWeight}
                    disabled={!selectedFood.coeffRawToCooked}
                    onChange={(e) => handleCookedChange(e.target.value)}
                    className="w-full h-10 rounded-md bg-card border border-border px-3 text-xs disabled:bg-muted/50 disabled:cursor-not-allowed"
                    placeholder={selectedFood.coeffRawToCooked ? "Converti" : "N/A"}
                  />
                </div>
              </div>

              <div className="bg-muted/30 p-3 rounded-lg border border-border grid grid-cols-4 gap-2 text-center text-xs">
                <div>
                  <span className="text-[9px] text-muted-foreground block">Calories</span>
                  <strong className="text-foreground">{equivMacros.kcal} kcal</strong>
                </div>
                <div>
                  <span className="text-[9px] text-muted-foreground block">Protéines</span>
                  <strong className="text-foreground">{equivMacros.p}g</strong>
                </div>
                <div>
                  <span className="text-[9px] text-muted-foreground block">Glucides</span>
                  <strong className="text-foreground">{equivMacros.c}g</strong>
                </div>
                <div>
                  <span className="text-[9px] text-muted-foreground block">Lipides</span>
                  <strong className="text-foreground">{equivMacros.f}g</strong>
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground italic block text-center">
                * Les valeurs nutritionnelles correspondent au poids cru calculé.
              </span>
            </div>
          )}

          {activeSubTab === "calc" && (
            <div className="space-y-4 pt-1">
              {items.length === 0 ? (
                <div className="text-center py-6 text-xs text-muted-foreground font-serif">
                  Aucun aliment dans ce repas. Clique sur "Ajouter" pour commencer.
                </div>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                  {items.map(item => (
                    <div key={item.id} className="p-3 bg-muted/30 rounded-lg border border-border/80 flex flex-col gap-2 relative">
                      <button
                        onClick={() => removeItem(item.id)}
                        className="absolute top-2 right-2 text-muted-foreground hover:text-red-500 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <div className="flex gap-2 items-center">
                        <select
                          value={item.foodId}
                          onChange={(e) => updateItem(item.id, { foodId: e.target.value })}
                          className="flex-1 h-9 rounded-md bg-card border border-border px-2 text-xs"
                        >
                          {FOOD_DATABASE.map(f => (
                            <option key={f.id} value={f.id}>{f.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-1 bg-card border border-border rounded-md px-2 h-9">
                          <input
                            type="number"
                            value={item.weight || ""}
                            onChange={(e) => updateItem(item.id, { weight: parseFloat(e.target.value) || 0 })}
                            className="w-full bg-transparent border-0 outline-hidden text-xs text-center"
                            placeholder="Quantité"
                          />
                          <span className="text-[10px] text-muted-foreground">
                            {FOOD_DATABASE.find(f => f.id === item.foodId)?.unit || "g"}
                          </span>
                        </div>
                        {FOOD_DATABASE.find(f => f.id === item.foodId)?.cooked && (
                          <div className="flex rounded-md border border-border overflow-hidden h-9">
                            <button
                              onClick={() => updateItem(item.id, { isCooked: false })}
                              className={`flex-1 text-[10px] font-semibold cursor-pointer ${
                                !item.isCooked ? "bg-primary text-cream" : "bg-card text-muted-foreground"
                              }`}
                            >
                              Cru
                            </button>
                            <button
                              onClick={() => updateItem(item.id, { isCooked: true })}
                              className={`flex-1 text-[10px] font-semibold cursor-pointer ${
                                item.isCooked ? "bg-primary text-cream" : "bg-card text-muted-foreground"
                              }`}
                            >
                              Cuit
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Button onClick={addItem} variant="outline" className="w-full h-9 text-xs flex items-center justify-center gap-1">
                <Plus className="h-3 w-3" /> Ajouter un aliment
              </Button>

              {items.length > 0 && (
                <div className="bg-primary/5 p-4 rounded-lg border border-primary/20 space-y-3">
                  <div className="flex justify-between items-center text-xs font-serif">
                    <span className="font-semibold text-secondary">Total du repas :</span>
                    <div className="text-right">
                      <span className="font-bold text-primary text-sm block">{totals.kcal} kcal</span>
                      <span className="text-[9px] text-muted-foreground block mt-0.5">
                        ({Math.round((totals.kcal / planKcal) * 100)}% de ta cible journalière)
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-semibold">
                    <div className="bg-card p-1.5 rounded border border-border">
                      <span className="text-[8px] text-muted-foreground block">Protéines</span>
                      <span className="text-foreground">{totals.p} g</span>
                      <span className="text-[8px] text-primary/80 block mt-0.5">
                        ({Math.round((totals.p / planMacros.p) * 100)}%)
                      </span>
                    </div>
                    <div className="bg-card p-1.5 rounded border border-border">
                      <span className="text-[8px] text-muted-foreground block">Glucides</span>
                      <span className="text-foreground">{totals.c} g</span>
                      <span className="text-[8px] text-primary/80 block mt-0.5">
                        ({Math.round((totals.c / planMacros.c) * 100)}%)
                      </span>
                    </div>
                    <div className="bg-card p-1.5 rounded border border-border">
                      <span className="text-[8px] text-muted-foreground block">Lipides</span>
                      <span className="text-foreground">{totals.f} g</span>
                      <span className="text-[8px] text-primary/80 block mt-0.5">
                        ({Math.round((totals.f / planMacros.f) * 100)}%)
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

