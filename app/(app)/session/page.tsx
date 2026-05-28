/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  query,
  where,
  limit,
  getDocs,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/firebase/hooks";
import { Loader } from "@/components/ui/loader";
import { HudCard, PanelHeader, Tag } from "@/components/nodream";
import { Dumbbell, Play, RotateCcw, AlertTriangle } from "lucide-react";
import type { PlanDoc, PlanTrainingSession } from "@/types/plan";
import type { SessionDoc } from "@/types/session";

/**
 * Landing page /session :
 * - If an in_progress session exists → CTA "Reprendre la session"
 * - Otherwise → cards for each session block of the active plan with CTA "Démarrer"
 */
export default function SessionLandingPage() {
  const { user, loading, getFreshToken } = useAuth();
  const router = useRouter();
  const [plan, setPlan] = useState<PlanDoc | null>(null);
  const [inProgress, setInProgress] = useState<{ id: string; data: SessionDoc } | null>(null);
  const [starting, setStarting] = useState<number | null>(null);
  const [fetching, setFetching] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user) return;

    const load = async () => {
      try {
        // 1. Active plan
        const planSnap = await getDocs(
          query(
            collection(db, "users", user.uid, "plans"),
            where("active", "==", true),
            limit(1),
          ),
        );
        if (!planSnap.empty) {
          setPlan({ id: planSnap.docs[0].id, ...planSnap.docs[0].data() } as PlanDoc);
        }

        // 2. In-progress session
        const ipSnap = await getDocs(
          query(
            collection(db, "users", user.uid, "workout_sessions"),
            where("status", "==", "in_progress"),
            orderBy("started_at", "desc"),
            limit(1),
          ),
        );
        if (!ipSnap.empty) {
          setInProgress({
            id: ipSnap.docs[0].id,
            data: ipSnap.docs[0].data() as SessionDoc,
          });
        }
      } catch (e: any) {
        console.error("[session/landing] load failed:", e);
        setErr(e?.message ?? "Erreur de chargement");
      } finally {
        setFetching(false);
      }
    };

    load();
  }, [user, loading]);

  const handleStart = (blockIndex: number, _block: PlanTrainingSession) => {
    if (!user || !plan?.id) return;
    // Nouvelle archi post-séance : pas d'API start, redirect direct vers le
    // formulaire de log. La session sera créée en Firestore en 1 seul POST
    // /api/sessions/log-full au moment "Enregistrer la séance".
    router.push(`/session/log/${plan.id}?block=${blockIndex}`);
  };

  if (loading || fetching) {
    return <Loader size="fullscreen" message="Initialisation séance..." />;
  }

  if (!plan) {
    return (
      <div className="flex-1 flex items-center justify-center px-6 py-10">
        <HudCard accent="gold" chamfer="sm" className="max-w-md w-full" style={{ padding: "1.5rem" }}>
          <PanelHeader code="PLAN-INTROUVABLE" title="Aucun plan actif" accent="gold" />
          <p style={{ fontSize: "var(--type-body-sm)", color: "var(--fg-3)", margin: "0 0 16px 0" }}>
            Tu dois compléter ton onboarding pour qu&apos;ORACLE.IA génère ton programme.
          </p>
          <button onClick={() => router.push("/onboarding")} className="btn btn-primary" style={{ width: "100%" }}>
            Démarrer l&apos;onboarding
          </button>
        </HudCard>
      </div>
    );
  }

  const sessions = plan.training?.sessions ?? [];

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10 space-y-6">
      {/* Tactical header */}
      <div className="space-y-2">
        <span
          className="mono"
          style={{
            fontSize: 10,
            letterSpacing: "0.3em",
            color: "var(--accent-tech)",
            opacity: 0.85,
          }}
        >
          [SESSION · SÉLECTEUR]
        </span>
        <h2
          style={{
            fontFamily: "var(--font-sans)",
            fontWeight: 900,
            fontSize: "var(--type-h1)",
            letterSpacing: "var(--tracking-display)",
            lineHeight: 1.05,
            color: "var(--fg-1)",
          }}
        >
          Lancer une <span style={{ color: "var(--gold-400)" }}>opération</span>
        </h2>
        <p
          className="mono"
          style={{
            fontSize: "var(--type-meta)",
            letterSpacing: "0.18em",
            color: "var(--fg-4)",
            textTransform: "uppercase",
          }}
        >
          Choisis un bloc · enregistre charges, reps, RPE en temps réel
        </p>
      </div>

      {err && (
        <div
          role="alert"
          className="mono"
          style={{
            padding: "10px 14px",
            background: "var(--alert-tint-15)",
            border: "1px solid var(--alert-500)",
            color: "var(--alert-500)",
            fontSize: 11,
            letterSpacing: "0.1em",
            clipPath:
              "polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)",
          }}
        >
          <span style={{ fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: 4 }}>
            [ERR-SESSION]
          </span>
          {err}
        </div>
      )}

      {/* Session in_progress résiduelle de l'ancien live tracking — affichée
          en info seulement (plus de bouton "Reprendre" : la nouvelle archi
          est en log post-séance, voir /session/log/[planId]). */}
      {inProgress && (
        <HudCard accent="tech" chamfer="sm" style={{ padding: "0.75rem 1rem" }}>
          <p className="mono" style={{ fontSize: 10, letterSpacing: "0.15em", color: "var(--fg-5)", textTransform: "uppercase", margin: 0 }}>
            [INFO] Ancienne session live `{inProgress.data.session_code}` toujours marquée in_progress en Firestore — sans incidence sur le nouveau flow post-séance.
          </p>
        </HudCard>
      )}

      {/* Session blocks grid */}
      <div className="space-y-3">
        <div className="px-1">
          <span
            className="mono"
            style={{ fontSize: 10, letterSpacing: "0.3em", color: "var(--gold-500)", opacity: 0.85 }}
          >
            [BLOCS-DISPO · {sessions.length}]
          </span>
          <h3
            style={{
              fontFamily: "var(--font-sans)",
              fontWeight: 900,
              fontSize: "1.25rem",
              color: "var(--fg-1)",
              margin: 0,
              marginTop: 4,
            }}
          >
            Blocs du programme
          </h3>
        </div>

        {sessions.length === 0 ? (
          <HudCard accent="gold" chamfer="sm" style={{ padding: "1.25rem" }}>
            <p className="mono text-center" style={{ fontSize: 11, color: "var(--fg-4)", letterSpacing: "0.1em" }}>
              Aucun bloc d&apos;entraînement dans le plan actif.
            </p>
          </HudCard>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sessions.map((block, idx) => (
              <HudCard
                key={idx}
                accent="gold"
                chamfer="sm"
                style={{ padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: 12 }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span
                      className="mono"
                      style={{ fontSize: 9, letterSpacing: "0.3em", color: "var(--gold-500)", opacity: 0.75 }}
                    >
                      [OP-{(idx + 1).toString().padStart(2, "0")}]
                    </span>
                    <h4
                      style={{
                        fontFamily: "var(--font-sans)",
                        fontSize: 16,
                        fontWeight: 900,
                        color: "var(--fg-1)",
                        margin: "4px 0 0 0",
                      }}
                    >
                      {block.name}
                    </h4>
                  </div>
                  <Dumbbell className="h-4 w-4" style={{ color: "var(--gold-400)" }} aria-hidden="true" />
                </div>

                {/* Audit UX 2026-05-28 : ajout durée estimée + focus muscles via heuristique
                    sur le nom du bloc (Push/Pull/Legs/Upper/Lower/Full/Cardio). */}
                {(() => {
                  // Estimation durée : pour chaque exo, sets × (30s effort moyen + rest_seconds).
                  // Ajout 10% buffer pour transitions/installation.
                  const totalSec = block.exercises.reduce(
                    (sum, ex) => sum + (ex.sets ?? 3) * (30 + (ex.rest_seconds ?? 90)),
                    0,
                  );
                  const estimatedMin = Math.round((totalSec * 1.1) / 60);

                  // Focus muscles : heuristique sur le nom du bloc
                  const upper = (block.name ?? "").toUpperCase();
                  let focus = "Mix";
                  if (/PUSH|POUSS/.test(upper)) focus = "Pectoraux · Épaules · Triceps";
                  else if (/PULL|TIR|DOS/.test(upper)) focus = "Dos · Biceps";
                  else if (/LEGS?|JAMB|LOWER|BAS/.test(upper)) focus = "Quadriceps · Fessiers · Mollets";
                  else if (/UPPER|HAUT/.test(upper)) focus = "Haut du corps complet";
                  else if (/FULL|BODY/.test(upper)) focus = "Full body";
                  else if (/CARDIO|RUN|COURSE/.test(upper)) focus = "Cardio";
                  else if (/CHEST|PEC|POITRINE/.test(upper)) focus = "Pectoraux";
                  else if (/BACK|DOS/.test(upper)) focus = "Dos";
                  else if (/ARMS?|BRAS/.test(upper)) focus = "Bras (biceps + triceps)";
                  else if (/SHOULDER|EPAULE|ÉPAULE/.test(upper)) focus = "Épaules";
                  else if (/CORE|ABS|ABDO/.test(upper)) focus = "Core · Abdominaux";

                  return (
                    <>
                      <div className="grid grid-cols-3 gap-2">
                        <div
                          style={{
                            padding: 8,
                            background: "var(--glass-bg-2)",
                            border: "1px solid var(--glass-border)",
                            clipPath:
                              "polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)",
                          }}
                        >
                          <span className="eyebrow" style={{ color: "var(--fg-4)" }}>Exos</span>
                          <div className="mono" style={{ fontSize: 14, fontWeight: 700, color: "var(--fg-1)", marginTop: 2 }}>
                            {block.exercises.length}
                          </div>
                        </div>
                        <div
                          style={{
                            padding: 8,
                            background: "var(--gold-tint-08)",
                            border: "1px solid var(--gold-tint-25)",
                            clipPath:
                              "polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)",
                          }}
                        >
                          <span className="eyebrow">Fréq</span>
                          <div
                            className="mono"
                            style={{ fontSize: 14, fontWeight: 700, color: "var(--gold-400)", marginTop: 2 }}
                          >
                            {block.frequency_weekly}×/sem
                          </div>
                        </div>
                        <div
                          style={{
                            padding: 8,
                            background: "var(--glass-bg-2)",
                            border: "1px solid var(--glass-border)",
                            clipPath:
                              "polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)",
                          }}
                        >
                          <span className="eyebrow" style={{ color: "var(--fg-4)" }}>Durée</span>
                          <div className="mono" style={{ fontSize: 14, fontWeight: 700, color: "var(--fg-1)", marginTop: 2 }}>
                            ~{estimatedMin}min
                          </div>
                        </div>
                      </div>
                      <div
                        style={{
                          padding: "6px 8px",
                          background: "var(--glass-bg-2)",
                          border: "1px solid var(--glass-border)",
                          marginTop: 8,
                          clipPath:
                            "polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)",
                        }}
                      >
                        <span className="eyebrow" style={{ color: "var(--fg-4)" }}>Focus</span>
                        <div style={{ fontSize: 12, color: "var(--fg-2)", marginTop: 1 }}>
                          {focus}
                        </div>
                      </div>
                    </>
                  );
                })()}

                <button
                  onClick={() => handleStart(idx, block)}
                  className="btn btn-primary"
                  style={{ width: "100%" }}
                >
                  <Play className="h-4 w-4" aria-hidden="true" /> Lancer
                </button>
              </HudCard>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
