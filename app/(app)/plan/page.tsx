/* eslint-disable react/no-unescaped-entities */
"use client";

import { Loader } from "@/components/ui/loader";
import React, { useEffect, useState, useMemo } from "react";
import { collection, query, where, limit, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/firebase/hooks";
import { useRouter } from "next/navigation";
import { PlanDoc } from "@/types/plan";
import { Flame, Dumbbell, ShieldCheck, Apple, Calendar, Scale, ChevronDown, ChevronUp, Plus, Trash2, Pill } from "lucide-react";
import { groupSupplementsByMeal } from "@/lib/features/plans/group-supplements";
import { MealCard } from "@/components/plan/meal-card";
import { MacroBar } from "@/components/plan/macro-bar";
import { ExerciseCard } from "@/components/plan/exercise-card";
import { getExercisePosterUrl } from "@/lib/features/plans/exercise-images";
import { getRecipeForMealName } from "@/lib/features/plans/meal-images";
import { HudCard, PanelHeader, Tag } from "@/components/nodream";
import { computeDefaultTargetMl } from "@/lib/features/hydration/schema";
import { exerciseNameToId, type Pr } from "@/lib/features/personal-records/schema";

export default function PlanPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"nutrition" | "training">("nutrition");
  const [plan, setPlan] = useState<PlanDoc | null>(null);
  const [profileData, setProfileData] = useState<any>(null);
  const [prs, setPrs] = useState<Record<string, Pr>>({});
  const [fetching, setFetching] = useState(true);
  const [dyslexicFriendly, setDyslexicFriendly] = useState(false);

  useEffect(() => {
    if (loading || !user) return;

    const fetchPlanAndProfile = async () => {
      try {
        const plansRef = collection(db, "users", user.uid, "plans");
        const plansQuery = query(plansRef, where("active", "==", true), limit(1));
        const prsRef = collection(db, "users", user.uid, "prs");

        const [plansSnap, userSnap, prsSnap] = await Promise.all([
          getDocs(plansQuery),
          getDoc(doc(db, "users", user.uid)),
          getDocs(prsRef),
        ]);

        if (!plansSnap.empty) {
          setPlan({ id: plansSnap.docs[0].id, ...plansSnap.docs[0].data() } as PlanDoc);
        }
        if (userSnap.exists()) {
          setProfileData(userSnap.data());
        }

        const prsMap: Record<string, Pr> = {};
        prsSnap.forEach((doc) => {
          const data = doc.data() as Pr;
          prsMap[data.exercise_id] = data;
        });
        setPrs(prsMap);

        setFetching(false);
      } catch (err) {
        console.error("Error loading plan or profile:", err);
        setFetching(false);
      }
    };

    fetchPlanAndProfile();
  }, [user, loading]);

  const hydrationTarget = useMemo(() => {
    if (!profileData) return 2500;
    return computeDefaultTargetMl({
      hormonal_context: profileData.profile?.hormonal_context,
      uses_glp1: profileData.profile?.uses_glp1 || profileData.medical?.glp1?.active,
      activity_level: profileData.profile?.activity_level,
    });
  }, [profileData]);

  const getPrLabel = (exoName: string) => {
    const exoId = exerciseNameToId(exoName);
    const prEntry = prs[exoId];
    if (!prEntry || !prEntry.prs || prEntry.prs.length === 0) return undefined;
    const lastPrEntry = prEntry.prs[prEntry.prs.length - 1];
    return `Dernier PR: ${lastPrEntry.weight_kg} kg x ${lastPrEntry.reps} reps`;
  };

  if (loading || fetching) {
    return (
      <Loader size="fullscreen" message="Chargement de ton plan d'action..." />
    );
  }

  if (!plan) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center py-10 px-6 text-center">
        <HudCard accent="gold" chamfer="sm" className="max-w-md w-full" style={{ padding: '1.5rem' }}>
          <PanelHeader
            code="PLAN-INTROUVABLE"
            title="Aucun plan actif"
            accent="gold"
          />
          <p
            style={{
              fontSize: 'var(--type-body-sm)',
              color: 'var(--fg-3)',
              lineHeight: 1.5,
              margin: '0 0 16px 0',
            }}
          >
            Tu dois d&apos;abord compléter ton onboarding pour qu&apos;ORACLE.IA calibre ton plan personnalisé.
          </p>
          <button
            onClick={() => router.push("/onboarding")}
            className="btn btn-primary"
            style={{ width: '100%' }}
          >
            Démarrer l&apos;onboarding
          </button>
        </HudCard>
      </div>
    );
  }

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10 space-y-6 lg:space-y-8">
      {/* Tactical header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <span
            className="mono"
            style={{
              fontSize: 10,
              letterSpacing: '0.3em',
              color: 'var(--accent-tech)',
              opacity: 0.85,
            }}
          >
            [PLAN-TRANSFO] · ACTIF
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
            Plan de <span style={{ color: 'var(--gold-400)' }}>transformation</span>
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
            Calibré · {plan.date_start ? new Date(plan.date_start).toLocaleDateString("fr-FR") : "récent"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/plan/history")}
          className="btn btn-ghost mono"
          style={{
            height: 36,
            fontSize: 10,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          }}
        >
          Historique
        </button>
      </div>

      {/* Tactical Tabs */}
      <div
        className="grid grid-cols-2 gap-1 max-w-md"
        style={{
          padding: 4,
          background: 'var(--glass-bg-2)',
          border: '1px solid var(--glass-border)',
          clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)',
        }}
        role="tablist"
        aria-label="Sélecteur Nutrition / Entraînement"
      >
        <button
          onClick={() => setActiveTab("nutrition")}
          role="tab"
          aria-selected={activeTab === "nutrition"}
          className="mono flex items-center justify-center gap-2 py-2 px-3 transition-all"
          style={{
            fontSize: 10,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            fontWeight: 700,
            background: activeTab === "nutrition" ? 'var(--gold-tint-15)' : 'transparent',
            color: activeTab === "nutrition" ? 'var(--gold-400)' : 'var(--fg-4)',
            border: activeTab === "nutrition" ? '1px solid var(--gold-tint-35)' : '1px solid transparent',
            boxShadow: activeTab === "nutrition" ? 'var(--glow-gold-soft)' : 'none',
            clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
            cursor: 'pointer',
          }}
        >
          <Apple className="h-3.5 w-3.5" aria-hidden="true" /> 01 · Nutrition
        </button>
        <button
          onClick={() => setActiveTab("training")}
          role="tab"
          aria-selected={activeTab === "training"}
          className="mono flex items-center justify-center gap-2 py-2 px-3 transition-all"
          style={{
            fontSize: 10,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            fontWeight: 700,
            background: activeTab === "training" ? 'var(--accent-tech-tint)' : 'transparent',
            color: activeTab === "training" ? 'var(--accent-tech)' : 'var(--fg-4)',
            border: activeTab === "training" ? '1px solid var(--accent-tech)' : '1px solid transparent',
            boxShadow: activeTab === "training" ? '0 0 12px var(--accent-tech-tint-strong)' : 'none',
            clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
            cursor: 'pointer',
          }}
        >
          <Dumbbell className="h-3.5 w-3.5" aria-hidden="true" /> 02 · Entraînement
        </button>
      </div>

      {/* NUTRITION TAB */}
      {activeTab === "nutrition" && (
        <div className="grid gap-6 lg:grid-cols-3 lg:gap-8">
          {/* LEFT: cible + calculateur (sticky on desktop) */}
          <div className="space-y-6 lg:col-span-1 lg:sticky lg:top-6 lg:self-start">
            <HudCard accent="gold" chamfer="sm" style={{ padding: '1rem 1.25rem' }}>
              <PanelHeader
                code="CIBLE-ENERG"
                title={
                  <span className="flex items-center gap-2">
                    <Flame className="h-4 w-4" style={{ color: 'var(--gold-400)' }} aria-hidden="true" />
                    Cible énergétique
                  </span>
                }
                accent="gold"
              />

              {/* Kcal cible — gros chiffre tactical */}
              <div
                style={{
                  textAlign: 'center',
                  padding: '14px 12px',
                  background: 'var(--gold-tint-08)',
                  border: '1px solid var(--gold-tint-25)',
                  boxShadow: 'var(--glow-gold-soft)',
                  clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)',
                }}
              >
                <span className="eyebrow">Quotidien</span>
                <div className="mt-1 flex items-baseline justify-center gap-2">
                  <span className="stat-num gold" style={{ fontSize: '2.6rem', lineHeight: 1 }}>
                    {plan.kcal}
                  </span>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--fg-3)', letterSpacing: '0.1em' }}>
                    kcal
                  </span>
                </div>
              </div>

              {/* Macros cibles — Audit #11 : optional chaining (un plan legacy
                  ou partiel sans `macros` faisait crash plein écran ; la page
                  history gardait déjà, pas celle-ci). */}
              <div className="space-y-3 mt-4">
                <MacroBar label="Protéines" value={plan.macros?.p ?? 0} />
                <MacroBar label="Glucides" value={plan.macros?.c ?? 0} />
                <MacroBar label="Lipides" value={plan.macros?.f ?? 0} />
              </div>
              <p
                className="mono mt-3"
                style={{
                  fontSize: 9,
                  color: 'var(--fg-5)',
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  lineHeight: 1.5,
                  margin: '12px 0 0 0',
                }}
              >
                Valeurs cibles · consommation réelle après bilan du jour
              </p>
            </HudCard>

            {plan.macros && <MealCalculator planKcal={plan.kcal} planMacros={plan.macros} />}
          </div>

          {/* RIGHT: repas (grille de cartes sur desktop) */}
          <div className="space-y-4 lg:col-span-2">
            <div className="px-1 space-y-1">
              <span
                className="mono"
                style={{
                  fontSize: 10,
                  letterSpacing: '0.3em',
                  color: 'var(--gold-500)',
                  opacity: 0.85,
                }}
              >
                [REPAS-{(plan.meals_template?.length ?? 0).toString().padStart(2, '0')}]
              </span>
              <h3
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 900,
                  fontSize: '1.25rem',
                  letterSpacing: '-0.01em',
                  color: 'var(--fg-1)',
                  margin: 0,
                }}
              >
                Suggestions opérationnelles
              </h3>
            </div>
            {(() => {
              const grouped = groupSupplementsByMeal(plan.meals_template, plan.supplements);
              return (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {grouped.meals.map((meal, idx) => {
                       const recipe = getRecipeForMealName(meal.name, meal.description);
                       return (
                         <MealCard
                           key={idx}
                           meal={{
                             name: meal.name,
                             description: meal.description || recipe?.description,
                             approxKcal: meal.approx_kcal,
                             supplements: meal.supplements,
                             photoUrl: recipe?.photoUrl,
                             // Audit #10 : priorité aux items + macros calibrés par
                             // l'IA (meal.*) ; la librairie de recettes ne sert que
                             // de fallback décoratif si le plan n'a pas le détail.
                             items: meal.items,
                             macros: meal.macros ?? recipe?.macros,
                           }}
                         />
                       );
                     })}
                  </div>

                  <div className="grid gap-6 md:grid-cols-2 mt-6">
                    {/* Card Hydratation */}
                    <HudCard accent="tech" chamfer="sm" style={{ padding: '1rem 1.25rem' }}>
                      <PanelHeader
                        code="HYDRATATION"
                        title={
                          <span className="flex items-center gap-2">
                            <span className="h-4 w-4 text-[13px] font-bold font-mono text-[var(--accent-tech)] flex items-center justify-center">H₂O</span>
                            Objectif Hydratation
                          </span>
                        }
                        accent="tech"
                      />
                      <div className="flex items-baseline justify-between mt-4">
                        <span className="mono text-[11px] text-zinc-400">Cible quotidienne recommandée :</span>
                        <div className="flex items-baseline gap-1">
                          <span className="stat-num tech text-3xl font-extrabold">{hydrationTarget}</span>
                          <span className="mono text-[10px] text-zinc-500">ml</span>
                        </div>
                      </div>
                      <p className="mono mt-4 text-[9px] text-[var(--fg-5)] uppercase tracking-wider leading-relaxed">
                        Calibré avec ton niveau d'activité et ton profil de santé
                      </p>
                    </HudCard>

                    {grouped.orphans.length > 0 && (
                      <HudCard accent="tech" chamfer="sm" style={{ padding: '1rem 1.25rem' }}>
                        <PanelHeader
                          code="SUPP-ORPHELINS"
                          title={
                            <span className="flex items-center gap-2">
                              <Pill className="h-4 w-4" style={{ color: 'var(--accent-tech)' }} aria-hidden="true" />
                              Compléments hors repas
                            </span>
                          }
                          accent="tech"
                        />
                        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }} className="mt-2">
                          {grouped.orphans.map((sup, idx) => (
                            <li
                              key={idx}
                              className="flex justify-between items-start"
                              style={{
                                padding: '10px 0',
                                borderBottom: idx < grouped.orphans.length - 1
                                  ? '1px solid var(--glass-border)'
                                  : 'none',
                              }}
                            >
                              <div>
                                <strong
                                  style={{
                                    fontSize: 13,
                                    color: 'var(--fg-1)',
                                    fontWeight: 700,
                                  }}
                                >
                                  {sup.name}
                                </strong>
                                <span
                                  className="mono"
                                  style={{
                                    fontSize: 9,
                                    letterSpacing: '0.15em',
                                    color: 'var(--fg-5)',
                                    textTransform: 'uppercase',
                                    display: 'block',
                                    marginTop: 2,
                                  }}
                                >
                                  {sup.timing}
                                </span>
                              </div>
                              <span
                                className="mono"
                                style={{
                                  fontSize: 12,
                                  color: 'var(--accent-tech)',
                                  fontWeight: 700,
                                  letterSpacing: '0.05em',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {sup.dosage}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </HudCard>
                    )}
                  </div>
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
            <div className="px-1 space-y-1">
              <span
                className="mono"
                style={{
                  fontSize: 10,
                  letterSpacing: '0.3em',
                  color: 'var(--gold-500)',
                  opacity: 0.85,
                }}
              >
                [PROG-{(plan.training?.sessions?.length ?? 0).toString().padStart(2, '0')}]
              </span>
              <h3
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 900,
                  fontSize: '1.25rem',
                  letterSpacing: '-0.01em',
                  color: 'var(--fg-1)',
                  margin: 0,
                }}
              >
                Programme sportif
              </h3>
            </div>
            {(plan.training?.sessions ?? []).map((session, sIdx) => (
              <section key={sIdx} className="space-y-3">
                <HudCard accent="gold" chamfer="sm" style={{ padding: '0.85rem 1rem' }}>
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <span
                        className="mono"
                        style={{
                          fontSize: 9,
                          letterSpacing: '0.3em',
                          color: 'var(--gold-500)',
                          opacity: 0.75,
                        }}
                      >
                        [SES-{(sIdx + 1).toString().padStart(2, '0')}]
                      </span>
                      <h4
                        style={{
                          fontFamily: 'var(--font-sans)',
                          fontSize: 16,
                          fontWeight: 900,
                          letterSpacing: '-0.01em',
                          color: 'var(--fg-1)',
                          margin: 0,
                        }}
                      >
                        {session.name}
                      </h4>
                    </div>
                    <Tag accent="gold">
                      <span className="tabular-nums">{session.frequency_weekly}×</span> / sem
                    </Tag>
                  </div>
                </HudCard>
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
                        posterUrl: getExercisePosterUrl(ex.name),
                      }}
                      lastPr={getPrLabel(ex.name)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>

          {/* RIGHT: cardio (col-span-1, sticky) */}
          {plan.cardio && (
            <div className="lg:col-span-1 lg:sticky lg:top-6 lg:self-start">
              <HudCard accent="tech" chamfer="sm" style={{ padding: '1rem 1.25rem' }}>
                <PanelHeader
                  code="CARDIO-VASC"
                  title={
                    <span className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" style={{ color: 'var(--accent-tech)' }} aria-hidden="true" />
                      Travail cardio
                    </span>
                  }
                  accent="tech"
                />
                <div className="grid grid-cols-2 gap-2">
                  <div
                    style={{
                      padding: 10,
                      textAlign: 'center',
                      background: 'var(--glass-bg-2)',
                      border: '1px solid var(--glass-border)',
                      clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
                    }}
                  >
                    <span className="eyebrow" style={{ color: 'var(--fg-4)' }}>Type</span>
                    <div
                      className="mono"
                      style={{
                        fontSize: 13,
                        color: 'var(--fg-1)',
                        fontWeight: 700,
                        marginTop: 4,
                        textTransform: 'uppercase',
                      }}
                    >
                      {plan.cardio.type}
                    </div>
                  </div>
                  <div
                    style={{
                      padding: 10,
                      textAlign: 'center',
                      background: 'var(--accent-tech-tint)',
                      border: '1px solid var(--accent-tech)',
                      clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
                      boxShadow: '0 0 10px var(--accent-tech-tint-strong)',
                    }}
                  >
                    <span className="eyebrow" style={{ color: 'var(--accent-tech)' }}>Intensité</span>
                    <div
                      className="mono"
                      style={{
                        fontSize: 13,
                        color: 'var(--accent-tech)',
                        fontWeight: 700,
                        marginTop: 4,
                        textTransform: 'uppercase',
                      }}
                    >
                      {plan.cardio.intensity}
                    </div>
                  </div>
                </div>
                <p
                  className="mono"
                  style={{
                    fontSize: 10,
                    color: 'var(--fg-4)',
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    marginTop: 12,
                    textAlign: 'center',
                    lineHeight: 1.5,
                  }}
                >
                  <span className="tabular-nums" style={{ color: 'var(--accent-tech)', fontWeight: 700 }}>
                    {plan.cardio.frequency_weekly}×
                  </span>
                  {' · '}
                  <span className="tabular-nums" style={{ color: 'var(--gold-400)', fontWeight: 700 }}>
                    {plan.cardio.duration_minutes}min
                  </span>
                  {' / semaine'}
                </p>
              </HudCard>
            </div>
          )}
        </div>
      )}

      {/* Justification / Strategy Card */}
      {plan.justification && (
        <HudCard accent="tech" chamfer="sm" style={{ padding: '1rem 1.25rem' }}>
          <PanelHeader
            code="ORACLE.IA · STRATÉGIE"
            title={
              <span className="flex items-center justify-between w-full pr-2">
                <span className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" style={{ color: 'var(--accent-tech)' }} aria-hidden="true" />
                  Justification du plan
                </span>
                <button
                  type="button"
                  onClick={() => setDyslexicFriendly((prev) => !prev)}
                  className="mono cursor-pointer transition-all hover:text-accent-tech px-2 py-0.5 text-[9px] uppercase border border-glass-border rounded"
                  style={{
                    background: dyslexicFriendly ? "var(--accent-tech-tint)" : "transparent",
                    color: dyslexicFriendly ? "var(--accent-tech)" : "var(--fg-4)",
                    borderColor: dyslexicFriendly ? "var(--accent-tech)" : "var(--glass-border)",
                  }}
                >
                  Mode lecture
                </button>
              </span>
            }
            accent="tech"
          />
          <p
            style={{
              fontFamily: dyslexicFriendly ? 'var(--font-sans)' : 'var(--font-serif)',
              fontStyle: dyslexicFriendly ? 'normal' : 'italic',
              fontSize: 'var(--type-body)',
              lineHeight: 1.6,
              letterSpacing: dyslexicFriendly ? '0.02em' : 'normal',
              color: 'var(--fg-2)',
              margin: 0,
            }}
          >
            {plan.justification}
          </p>
        </HudCard>
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

  // Input style helper
  const inputStyle: React.CSSProperties = {
    background: 'var(--glass-bg-2)',
    border: '1px solid var(--glass-border)',
    color: 'var(--fg-1)',
    fontSize: 12,
    padding: '0 12px',
    height: 40,
    clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
  };

  return (
    <HudCard accent="gold" chamfer="sm" style={{ padding: 0 }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between text-left cursor-pointer"
        style={{
          padding: '14px 18px',
          background: 'transparent',
          border: 0,
        }}
      >
        <span className="flex flex-col gap-1">
          <span
            className="mono"
            style={{
              fontSize: 9,
              letterSpacing: '0.3em',
              color: 'var(--gold-500)',
              opacity: 0.75,
              textTransform: 'uppercase',
            }}
          >
            [CALC-MACROS]
          </span>
          <span className="flex items-center gap-2" style={{ fontSize: 15, fontWeight: 800, color: 'var(--fg-1)' }}>
            <Scale className="h-4 w-4" style={{ color: 'var(--gold-400)' }} aria-hidden="true" />
            Équivalences & calories
          </span>
        </span>
        {isOpen
          ? <ChevronUp className="h-4 w-4" style={{ color: 'var(--gold-400)' }} aria-hidden="true" />
          : <ChevronDown className="h-4 w-4" style={{ color: 'var(--fg-4)' }} aria-hidden="true" />}
      </button>

      {isOpen && (
        <div
          className="space-y-4"
          style={{
            padding: '12px 18px 18px',
            borderTop: '1px solid var(--glass-border)',
          }}
        >
          {/* Sub-tabs tactical */}
          <div
            className="flex gap-1"
            style={{
              padding: 4,
              background: 'var(--glass-bg-2)',
              border: '1px solid var(--glass-border)',
              clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
            }}
            role="tablist"
          >
            <button
              onClick={() => setActiveSubTab("equiv")}
              role="tab"
              aria-selected={activeSubTab === "equiv"}
              className="mono flex-1 py-1.5 text-center transition-all"
              style={{
                fontSize: 9,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                fontWeight: 700,
                background: activeSubTab === "equiv" ? 'var(--gold-tint-15)' : 'transparent',
                color: activeSubTab === "equiv" ? 'var(--gold-400)' : 'var(--fg-4)',
                border: activeSubTab === "equiv" ? '1px solid var(--gold-tint-35)' : '1px solid transparent',
                clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)',
                cursor: 'pointer',
              }}
            >
              Cru / Cuit
            </button>
            <button
              onClick={() => setActiveSubTab("calc")}
              role="tab"
              aria-selected={activeSubTab === "calc"}
              className="mono flex-1 py-1.5 text-center transition-all"
              style={{
                fontSize: 9,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                fontWeight: 700,
                background: activeSubTab === "calc" ? 'var(--accent-tech-tint)' : 'transparent',
                color: activeSubTab === "calc" ? 'var(--accent-tech)' : 'var(--fg-4)',
                border: activeSubTab === "calc" ? '1px solid var(--accent-tech)' : '1px solid transparent',
                clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)',
                cursor: 'pointer',
              }}
            >
              Builder de repas
            </button>
          </div>

          {activeSubTab === "equiv" && (
            <div className="space-y-4 pt-1">
              <div>
                <label className="eyebrow" style={{ color: 'var(--fg-4)', display: 'block', marginBottom: 6 }}>
                  Aliment
                </label>
                <select
                  value={equivFoodId}
                  onChange={(e) => handleFoodChange(e.target.value)}
                  className="mono w-full"
                  style={inputStyle}
                >
                  {FOOD_DATABASE.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="eyebrow" style={{ color: 'var(--fg-4)', display: 'block', marginBottom: 6 }}>
                    Cru (g)
                  </label>
                  <input
                    type="number"
                    value={equivRawWeight}
                    onChange={(e) => handleRawChange(e.target.value)}
                    className="mono w-full"
                    style={inputStyle}
                    placeholder="Ex: 100"
                  />
                </div>
                <div>
                  <label className="eyebrow" style={{ color: 'var(--fg-4)', display: 'block', marginBottom: 6 }}>
                    Cuit (g)
                  </label>
                  <input
                    type="number"
                    value={equivCookedWeight}
                    disabled={!selectedFood.coeffRawToCooked}
                    onChange={(e) => handleCookedChange(e.target.value)}
                    className="mono w-full"
                    style={{
                      ...inputStyle,
                      opacity: !selectedFood.coeffRawToCooked ? 0.4 : 1,
                      cursor: !selectedFood.coeffRawToCooked ? 'not-allowed' : 'text',
                    }}
                    placeholder={selectedFood.coeffRawToCooked ? "Converti" : "N/A"}
                  />
                </div>
              </div>

              {/* Macros readout */}
              <div
                className="grid grid-cols-4 gap-2"
                style={{
                  padding: 12,
                  background: 'var(--gold-tint-08)',
                  border: '1px solid var(--gold-tint-25)',
                  boxShadow: 'var(--glow-gold-soft)',
                  clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)',
                }}
              >
                <div className="text-center">
                  <span className="eyebrow">kcal</span>
                  <div className="stat-num gold" style={{ fontSize: 16, lineHeight: 1.2, marginTop: 4 }}>
                    {equivMacros.kcal}
                  </div>
                </div>
                <div className="text-center">
                  <span className="eyebrow" style={{ color: 'var(--fg-4)' }}>P</span>
                  <div className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-1)', marginTop: 4 }}>
                    {equivMacros.p}<span style={{ fontSize: 9, color: 'var(--fg-5)', marginLeft: 1 }}>g</span>
                  </div>
                </div>
                <div className="text-center">
                  <span className="eyebrow" style={{ color: 'var(--fg-4)' }}>C</span>
                  <div className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-1)', marginTop: 4 }}>
                    {equivMacros.c}<span style={{ fontSize: 9, color: 'var(--fg-5)', marginLeft: 1 }}>g</span>
                  </div>
                </div>
                <div className="text-center">
                  <span className="eyebrow" style={{ color: 'var(--fg-4)' }}>F</span>
                  <div className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-1)', marginTop: 4 }}>
                    {equivMacros.f}<span style={{ fontSize: 9, color: 'var(--fg-5)', marginLeft: 1 }}>g</span>
                  </div>
                </div>
              </div>
              <p
                className="mono"
                style={{
                  fontSize: 9,
                  color: 'var(--fg-5)',
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  textAlign: 'center',
                  margin: 0,
                }}
              >
                * Valeurs sur poids cru
              </p>
            </div>
          )}

          {activeSubTab === "calc" && (
            <div className="space-y-4 pt-1">
              {items.length === 0 ? (
                <div
                  className="mono text-center"
                  style={{
                    padding: '24px 12px',
                    fontSize: 10,
                    letterSpacing: '0.2em',
                    color: 'var(--fg-5)',
                    textTransform: 'uppercase',
                    background: 'var(--glass-bg-2)',
                    border: '1px dashed var(--glass-border)',
                    clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
                  }}
                >
                  Aucun aliment chargé · clic [+] pour démarrer
                </div>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                  {items.map(item => {
                    const food = FOOD_DATABASE.find(f => f.id === item.foodId);
                    return (
                      <div
                        key={item.id}
                        className="flex flex-col gap-2 relative"
                        style={{
                          padding: 10,
                          background: 'var(--glass-bg-2)',
                          border: '1px solid var(--glass-border)',
                          clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
                        }}
                      >
                        <button
                          onClick={() => removeItem(item.id)}
                          aria-label="Supprimer cet aliment"
                          className="absolute"
                          style={{
                            top: 6,
                            right: 6,
                            color: 'var(--fg-5)',
                            background: 'transparent',
                            border: 0,
                            cursor: 'pointer',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--alert-500)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--fg-5)'; }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        <select
                          value={item.foodId}
                          onChange={(e) => updateItem(item.id, { foodId: e.target.value })}
                          className="mono"
                          style={{ ...inputStyle, height: 36, fontSize: 11 }}
                        >
                          {FOOD_DATABASE.map(f => (
                            <option key={f.id} value={f.id}>{f.name}</option>
                          ))}
                        </select>
                        <div className="grid grid-cols-2 gap-2">
                          <div
                            className="flex items-center gap-1"
                            style={{
                              background: 'var(--ink-900)',
                              border: '1px solid var(--glass-border)',
                              padding: '0 8px',
                              height: 36,
                              clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)',
                            }}
                          >
                            <input
                              type="number"
                              value={item.weight || ""}
                              onChange={(e) => updateItem(item.id, { weight: parseFloat(e.target.value) || 0 })}
                              className="mono w-full bg-transparent border-0 text-center focus:outline-none"
                              style={{ fontSize: 12, color: 'var(--fg-1)' }}
                              placeholder="Qté"
                            />
                            <span className="mono" style={{ fontSize: 9, color: 'var(--fg-4)', letterSpacing: '0.1em' }}>
                              {food?.unit || "g"}
                            </span>
                          </div>
                          {food?.cooked && (
                            <div
                              className="flex overflow-hidden"
                              style={{
                                height: 36,
                                border: '1px solid var(--glass-border)',
                                clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)',
                              }}
                            >
                              <button
                                onClick={() => updateItem(item.id, { isCooked: false })}
                                className="mono flex-1 cursor-pointer"
                                style={{
                                  fontSize: 9,
                                  letterSpacing: '0.2em',
                                  fontWeight: 700,
                                  textTransform: 'uppercase',
                                  background: !item.isCooked ? 'var(--gold-tint-15)' : 'transparent',
                                  color: !item.isCooked ? 'var(--gold-400)' : 'var(--fg-5)',
                                  border: 0,
                                }}
                              >
                                Cru
                              </button>
                              <button
                                onClick={() => updateItem(item.id, { isCooked: true })}
                                className="mono flex-1 cursor-pointer"
                                style={{
                                  fontSize: 9,
                                  letterSpacing: '0.2em',
                                  fontWeight: 700,
                                  textTransform: 'uppercase',
                                  background: item.isCooked ? 'var(--gold-tint-15)' : 'transparent',
                                  color: item.isCooked ? 'var(--gold-400)' : 'var(--fg-5)',
                                  border: 0,
                                }}
                              >
                                Cuit
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <button
                onClick={addItem}
                className="btn btn-ghost mono flex items-center justify-center gap-1"
                style={{
                  width: '100%',
                  fontSize: 10,
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                }}
              >
                <Plus className="h-3 w-3" aria-hidden="true" /> Ajouter
              </button>

              {items.length > 0 && (
                <div
                  className="space-y-3"
                  style={{
                    padding: 12,
                    background: 'var(--accent-tech-tint)',
                    border: '1px solid var(--accent-tech)',
                    boxShadow: '0 0 12px var(--accent-tech-tint-strong)',
                    clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)',
                  }}
                >
                  <div className="flex justify-between items-center">
                    <span
                      className="mono"
                      style={{
                        fontSize: 10,
                        letterSpacing: '0.2em',
                        color: 'var(--accent-tech)',
                        textTransform: 'uppercase',
                        fontWeight: 700,
                      }}
                    >
                      Total repas
                    </span>
                    <div className="text-right">
                      <span
                        className="stat-num tech"
                        style={{ fontSize: 22, lineHeight: 1 }}
                      >
                        {totals.kcal}
                      </span>
                      <span className="mono" style={{ fontSize: 9, color: 'var(--fg-4)', marginLeft: 4 }}>
                        kcal
                      </span>
                      <div className="mono" style={{ fontSize: 9, letterSpacing: '0.1em', color: 'var(--fg-4)', marginTop: 2 }}>
                        ({Math.round((totals.kcal / planKcal) * 100)}% cible)
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { letter: 'P', val: totals.p, target: planMacros.p },
                      { letter: 'C', val: totals.c, target: planMacros.c },
                      { letter: 'F', val: totals.f, target: planMacros.f },
                    ]).map((macro) => (
                      <div
                        key={macro.letter}
                        className="text-center"
                        style={{
                          padding: 6,
                          background: 'var(--ink-900)',
                          border: '1px solid var(--glass-border)',
                          clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)',
                        }}
                      >
                        <span className="eyebrow" style={{ color: 'var(--fg-4)' }}>{macro.letter}</span>
                        <div className="mono" style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-1)' }}>
                          {macro.val}<span style={{ fontSize: 8, color: 'var(--fg-5)' }}>g</span>
                        </div>
                        <div className="mono" style={{ fontSize: 8, color: 'var(--accent-tech)', marginTop: 1 }}>
                          {Math.round((macro.val / macro.target) * 100)}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </HudCard>
  );
}

