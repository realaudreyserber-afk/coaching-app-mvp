/* eslint-disable react/no-unescaped-entities */
/**
 * /plan/history — Historique des plans
 *
 * Liste TOUS les plans générés pour l'utilisateur (active + archivés),
 * triés par date_start desc. Chaque ligne montre un résumé (kcal, macros,
 * formule TDEE déduite de la justification, marker ACTIF si active===true)
 * et un toggle pour déplier les détails complets (justification + structure).
 *
 * L'idée est de pouvoir comparer "le plan d'avant" vs "le plan d'après"
 * une régénération (ex: avant/après ajout du BF% en onboarding) sans
 * perdre l'historique.
 */

"use client";

import { Loader } from "@/components/ui/loader";
import React, { useEffect, useState } from "react";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/firebase/hooks";
import { useRouter } from "next/navigation";
import { PlanDoc } from "@/types/plan";
import { ChevronDown, ChevronUp, ArrowLeft } from "lucide-react";
import { HudCard, PanelHeader, Tag } from "@/components/nodream";

function detectTdeeFormula(justification: string | undefined): string {
  if (!justification) return "—";
  const j = justification.toLowerCase();
  if (j.includes("katch") || j.includes("mcardle")) return "Katch-McArdle";
  if (j.includes("mifflin") || j.includes("st jeor") || j.includes("st-jeor"))
    return "Mifflin-St Jeor";
  return "—";
}

function formatDate(iso: string | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function PlanHistoryPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [plans, setPlans] = useState<PlanDoc[]>([]);
  const [fetching, setFetching] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user) return;

    const fetchAll = async () => {
      try {
        const plansRef = collection(db, "users", user.uid, "plans");
        // Wave 11E — Cap to the 50 most recent plans. Without limit, a power
        // user with months of weekly regenerations could pull hundreds of
        // docs on every visit. 50 = covers ~1 year of weekly regen + room
        // to spare. Pagination "Charger plus" can be added if needed.
        const q = query(plansRef, orderBy("created_at", "desc"), limit(50));
        const snap = await getDocs(q);
        setPlans(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PlanDoc),
        );
      } catch (err) {
        console.error("[plan/history] fetch failed:", err);
      } finally {
        setFetching(false);
      }
    };

    fetchAll();
  }, [user, loading]);

  if (loading || fetching) {
    return <Loader size="fullscreen" message="Chargement de l'historique..." />;
  }

  return (
    <div className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10 space-y-6">
      {/* Tactical header */}
      <div className="flex items-center justify-between">
        <div>
          <span
            className="mono"
            style={{
              fontSize: 10,
              letterSpacing: "0.3em",
              color: "var(--accent-tech)",
              opacity: 0.85,
            }}
          >
            [PLAN-ARCHIVES] · {plans.length} GÉNÉRATION{plans.length > 1 ? "S" : ""}
          </span>
          <h1
            className="font-serif"
            style={{
              fontSize: 32,
              margin: "6px 0 4px 0",
              color: "var(--fg-1)",
            }}
          >
            Historique des plans
          </h1>
          <p
            style={{
              fontSize: 12,
              color: "var(--fg-4)",
              margin: 0,
            }}
          >
            Chaque régénération (onboarding + IA) archive le précédent. Tu peux
            comparer les calibrations entre elles.
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/plan")}
          className="btn btn-ghost mono"
          style={{
            height: 36,
            fontSize: 10,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Plan actif
        </button>
      </div>

      {plans.length === 0 ? (
        <HudCard accent="gold" chamfer="sm" style={{ padding: "1.5rem" }}>
          <PanelHeader code="EMPTY" title="Aucun plan généré" accent="gold" />
          <p style={{ fontSize: 12, color: "var(--fg-4)", margin: "12px 0 0 0" }}>
            Termine ton onboarding pour générer ton premier plan.
          </p>
        </HudCard>
      ) : (
        <div className="space-y-3">
          {plans.map((p) => {
            const isOpen = expanded === p.id;
            const formula = detectTdeeFormula(p.justification);
            return (
              <HudCard
                key={p.id}
                accent={p.active ? "gold" : "tech"}
                chamfer="sm"
                style={{ padding: "1rem 1.25rem" }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {p.active && <Tag>ACTIF</Tag>}
                      <span
                        className="mono"
                        style={{
                          fontSize: 10,
                          color: "var(--fg-4)",
                          letterSpacing: "0.15em",
                        }}
                      >
                        {formatDate(p.created_at)} · {p.kcal} kcal · TDEE {formula}
                      </span>
                    </div>
                    <div
                      className="mono"
                      style={{
                        fontSize: 11,
                        color: "var(--fg-2)",
                        marginTop: 4,
                        letterSpacing: "0.05em",
                      }}
                    >
                      P {p.macros?.p}g · C {p.macros?.c}g · F {p.macros?.f}g
                      {" · "}
                      {p.training?.sessions?.length ?? 0} séance
                      {(p.training?.sessions?.length ?? 0) > 1 ? "s" : ""}/sem
                      {p.cardio?.type && ` · cardio ${p.cardio.type}`}
                      {p.source === "ai+coach_patched" && (
                        <>
                          {" · "}
                          <span style={{ color: "var(--accent-tech)" }}>
                            patché coach
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : (p.id ?? null))}
                    className="btn btn-ghost mono"
                    aria-expanded={isOpen}
                    style={{
                      height: 32,
                      fontSize: 10,
                      letterSpacing: "0.2em",
                      textTransform: "uppercase",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    {isOpen ? (
                      <>
                        Replier <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                      </>
                    ) : (
                      <>
                        Détails <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                      </>
                    )}
                  </button>
                </div>

                {isOpen && (
                  <div className="mt-4 space-y-4">
                    {p.justification && (
                      <div>
                        <div
                          className="mono"
                          style={{
                            fontSize: 9,
                            letterSpacing: "0.25em",
                            color: "var(--fg-5)",
                            textTransform: "uppercase",
                            marginBottom: 6,
                          }}
                        >
                          Justification
                        </div>
                        <p
                          style={{
                            fontSize: 12,
                            lineHeight: 1.6,
                            color: "var(--fg-3)",
                            whiteSpace: "pre-wrap",
                            margin: 0,
                          }}
                        >
                          {p.justification}
                        </p>
                      </div>
                    )}

                    {p.lifestyle_notes && (
                      <div>
                        <div
                          className="mono"
                          style={{
                            fontSize: 9,
                            letterSpacing: "0.25em",
                            color: "var(--fg-5)",
                            textTransform: "uppercase",
                            marginBottom: 6,
                          }}
                        >
                          Lifestyle
                        </div>
                        <p
                          style={{
                            fontSize: 12,
                            lineHeight: 1.6,
                            color: "var(--fg-3)",
                            whiteSpace: "pre-wrap",
                            margin: 0,
                          }}
                        >
                          {p.lifestyle_notes}
                        </p>
                      </div>
                    )}

                    {p.meals_template && p.meals_template.length > 0 && (
                      <div>
                        <div
                          className="mono"
                          style={{
                            fontSize: 9,
                            letterSpacing: "0.25em",
                            color: "var(--fg-5)",
                            textTransform: "uppercase",
                            marginBottom: 6,
                          }}
                        >
                          Repas ({p.meals_template.length})
                        </div>
                        <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                          {p.meals_template.map((m, i) => (
                            <li
                              key={i}
                              style={{
                                fontSize: 11,
                                color: "var(--fg-3)",
                                padding: "4px 0",
                                borderBottom:
                                  i < p.meals_template.length - 1
                                    ? "1px solid var(--glass-border)"
                                    : "none",
                              }}
                            >
                              <strong>{m.name}</strong> ({m.approx_kcal} kcal) ·{" "}
                              {m.description}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {p.training?.sessions && p.training.sessions.length > 0 && (
                      <div>
                        <div
                          className="mono"
                          style={{
                            fontSize: 9,
                            letterSpacing: "0.25em",
                            color: "var(--fg-5)",
                            textTransform: "uppercase",
                            marginBottom: 6,
                          }}
                        >
                          Séances ({p.training.sessions.length})
                        </div>
                        <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                          {p.training.sessions.map((s, i) => (
                            <li
                              key={i}
                              style={{
                                fontSize: 11,
                                color: "var(--fg-3)",
                                padding: "4px 0",
                                borderBottom:
                                  i < p.training.sessions.length - 1
                                    ? "1px solid var(--glass-border)"
                                    : "none",
                              }}
                            >
                              <strong>{s.name}</strong> · {s.frequency_weekly}×/sem ·{" "}
                              {s.exercises.length} exos
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {p.supplements && p.supplements.length > 0 && (
                      <div>
                        <div
                          className="mono"
                          style={{
                            fontSize: 9,
                            letterSpacing: "0.25em",
                            color: "var(--fg-5)",
                            textTransform: "uppercase",
                            marginBottom: 6,
                          }}
                        >
                          Suppléments ({p.supplements.length})
                        </div>
                        <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                          {p.supplements.map((s, i) => (
                            <li
                              key={i}
                              style={{
                                fontSize: 11,
                                color: "var(--fg-3)",
                                padding: "4px 0",
                              }}
                            >
                              <strong>{s.name}</strong> · {s.dosage} · {s.timing}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </HudCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
