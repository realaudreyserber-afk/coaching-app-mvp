/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/firebase/hooks";
import { Loader } from "@/components/ui/loader";
import { HudCard, PanelHeader, Tag } from "@/components/nodream";
import { ArrowLeft, Share2, Activity, Flame, Trophy, Weight, Timer } from "lucide-react";
import type { SessionDoc } from "@/types/session";

/**
 * /workout/summary?from=<sessionId>
 *
 * Récap d'une séance terminée + debrief ORACLE.IA (cached server-side).
 * Si pas de `from` query, fallback sur le dernier `last_session_summary`
 * dénormalisé sur users/{uid}.
 */
export default function WorkoutSummaryPage() {
  // Next.js 15 App Router requires useSearchParams() to live under a Suspense
  // boundary; otherwise the entire route opts out of SSG and prerender fails.
  return (
    <Suspense fallback={<Loader size="fullscreen" message="Chargement du récap..." />}>
      <WorkoutSummaryInner />
    </Suspense>
  );
}

function WorkoutSummaryInner() {
  const { user, loading, getFreshToken } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const sessionId = params?.get("from") ?? null;
  // Dedupe debrief generation per-session-id to survive React StrictMode double-effects
  // and fast back/forward navigation.
  const debriefRequestedFor = useRef<string | null>(null);

  const [session, setSession] = useState<(SessionDoc & { id: string }) | null>(null);
  const [fetching, setFetching] = useState(true);
  const [debrief, setDebrief] = useState<string | null>(null);
  const [debriefLoading, setDebriefLoading] = useState(false);
  const [debriefErr, setDebriefErr] = useState<string | null>(null);
  const [debriefIsCached, setDebriefIsCached] = useState(false);

  // Load the session doc (either from ?from= or fallback to last_session_summary)
  useEffect(() => {
    if (loading || !user) return;
    const load = async () => {
      try {
        let targetId = sessionId;
        if (!targetId) {
          // Fallback to denormalized last_session_summary
          const userSnap = await getDoc(doc(db, "users", user.uid));
          targetId = (userSnap.data()?.last_session_summary?.session_id as string | undefined) ?? null;
        }
        if (!targetId) {
          setFetching(false);
          return;
        }
        const snap = await getDoc(
          doc(db, "users", user.uid, "workout_sessions", targetId),
        );
        if (snap.exists()) {
          setSession({ id: snap.id, ...(snap.data() as SessionDoc) });
        }
      } catch (e) {
        console.error("[summary] load failed:", e);
      } finally {
        setFetching(false);
      }
    };
    load();
  }, [user, loading, sessionId]);

  // Trigger debrief generation once we have a session.
  // Dedupe via useRef to avoid double-fetch on StrictMode / navigation thrash.
  useEffect(() => {
    if (!session || !user || debrief) return;
    if (debriefRequestedFor.current === session.id) return;
    // Aborted sessions don't produce a useful debrief — server returns 409.
    if (session.status === "aborted") {
      setDebriefErr("Session abandonnée — pas de debrief.");
      return;
    }
    debriefRequestedFor.current = session.id;
    let cancelled = false;
    const generate = async () => {
      setDebriefLoading(true);
      setDebriefErr(null);
      try {
        const token = await getFreshToken();
        if (!token) throw new Error("Auth requise");
        const res = await fetch("/api/ai/coach-session-debrief", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ session_id: session.id }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "debrief_failed");
        if (!cancelled) {
          setDebrief(data.debrief);
          setDebriefIsCached(Boolean(data.cached));
        }
      } catch (e: any) {
        if (!cancelled) setDebriefErr(e?.message ?? "erreur");
      } finally {
        if (!cancelled) setDebriefLoading(false);
      }
    };
    generate();
    return () => {
      cancelled = true;
    };
  }, [session, user, debrief, getFreshToken]);

  const avgRpe = useMemo(() => {
    if (!session) return null;
    const rpes = session.exercises.flatMap((ex) => ex.sets_logged.map((s) => s.rpe_felt));
    if (rpes.length === 0) return null;
    return (rpes.reduce((a, b) => a + b, 0) / rpes.length).toFixed(1);
  }, [session]);

  if (loading || fetching) {
    return <Loader size="fullscreen" message="Chargement du récap..." />;
  }

  if (!session) {
    return (
      <div className="flex-1 flex items-center justify-center px-6 py-10">
        <HudCard accent="tech" chamfer="sm" style={{ padding: "1.5rem", maxWidth: 480 }}>
          <PanelHeader code="NO-SESSION" title="Aucune séance à afficher" accent="tech" />
          <p style={{ fontSize: 12, color: "var(--fg-3)", margin: "0 0 16px 0" }}>
            Termine une séance via /session pour voir ton récap ici.
          </p>
          <button onClick={() => router.push("/session")} className="btn btn-primary" style={{ width: "100%" }}>
            Aller au sélecteur
          </button>
        </HudCard>
      </div>
    );
  }

  const m = session.metrics;
  const durationMin = Math.round(m.duration_seconds / 60);

  const handleShare = (label: string, value: string) => {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      navigator
        .share({
          title: `${label} — NoDream`,
          text: `${label} : ${value}`,
        })
        .catch(() => undefined);
    }
  };

  return (
    <div className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10 space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          aria-label="Retour au tableau de bord"
          className="btn btn-ghost"
          style={{ height: 40, padding: "0 10px" }}
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <span
          className="mono"
          style={{
            fontSize: 10,
            letterSpacing: "0.3em",
            color: "var(--accent-tech)",
            textTransform: "uppercase",
          }}
        >
          [SESSION-FIN] · {session.session_code}
        </span>
      </div>

      {/* Hero */}
      <div className="space-y-2">
        <h1
          style={{
            fontFamily: "var(--font-sans)",
            fontWeight: 900,
            fontSize: "var(--type-h1)",
            letterSpacing: "var(--tracking-display)",
            lineHeight: 1.05,
            color: "var(--fg-1)",
          }}
        >
          Mission <span style={{ color: "var(--gold-400)" }}>accomplie</span>
        </h1>
        <p
          className="mono"
          style={{
            fontSize: "var(--type-meta)",
            letterSpacing: "0.18em",
            color: "var(--fg-4)",
            textTransform: "uppercase",
          }}
        >
          {session.operation_name}
        </p>
      </div>

      {/* Stats principales */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Durée"
          value={`${durationMin} min`}
          icon={<Timer className="h-4 w-4" style={{ color: "var(--accent-tech)" }} aria-hidden="true" />}
          accent="tech"
        />
        <StatCard
          label="Volume total"
          value={formatVolume(m.volume_kg)}
          delta={m.vs_previous_volume_pct}
          icon={<Weight className="h-4 w-4" style={{ color: "var(--gold-400)" }} aria-hidden="true" />}
          accent="gold"
        />
        <StatCard
          label="Sets complétés"
          value={`${m.sets_completed} / ${m.sets_planned}`}
          icon={<Trophy className="h-4 w-4" style={{ color: "var(--gold-400)" }} aria-hidden="true" />}
          accent="gold"
        />
        <StatCard
          label="RPE moyen"
          value={avgRpe ?? "—"}
          icon={<Flame className="h-4 w-4" style={{ color: "var(--alert-500)" }} aria-hidden="true" />}
          accent="tech"
        />
      </div>

      {/* Debrief ORACLE.IA */}
      <HudCard accent="tech" chamfer="sm" style={{ padding: "1rem 1.25rem" }}>
        <PanelHeader
          code="ORACLE.IA · DEBRIEF"
          title={
            <span className="flex items-center gap-2">
              <Activity className="h-4 w-4" style={{ color: "var(--accent-tech)" }} aria-hidden="true" />
              Analyse de la séance
            </span>
          }
          accent="tech"
          right={
            debrief
              ? <Tag accent="tech">{debriefIsCached ? 'CACHED' : 'LIVE'}</Tag>
              : debriefLoading
                ? <Tag accent="tech">ANALYSE...</Tag>
                : null
          }
        />
        {debriefLoading && !debrief && (
          <p
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--accent-tech)",
              letterSpacing: "0.1em",
              fontStyle: "italic",
            }}
          >
            ORACLE.IA · analyse en cours...
          </p>
        )}
        {debriefErr && (
          <p
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--alert-500)",
              letterSpacing: "0.05em",
            }}
          >
            [ERR-DEBRIEF] {debriefErr}
          </p>
        )}
        {debrief && (
          <p
            style={{
              fontFamily: "var(--font-serif)",
              fontStyle: "italic",
              fontSize: "var(--type-body)",
              lineHeight: 1.7,
              color: "var(--fg-1)",
              margin: 0,
            }}
          >
            « {debrief} »
          </p>
        )}
      </HudCard>

      {/* Top lift */}
      {(() => {
        const topLift = findTopLift(session);
        if (!topLift) return null;
        return (
          <HudCard accent="gold" chamfer="sm" style={{ padding: "1rem 1.25rem" }}>
            <PanelHeader
              code="TOP-LIFT"
              title={
                <span className="flex items-center gap-2">
                  <Trophy className="h-4 w-4" style={{ color: "var(--gold-400)" }} aria-hidden="true" />
                  Performance max de la séance
                </span>
              }
              accent="gold"
              right={
                <button
                  onClick={() =>
                    handleShare(
                      "Top lift",
                      `${topLift.exercise_name} ${topLift.weight_kg}kg × ${topLift.reps_done} reps`,
                    )
                  }
                  className="btn btn-ghost mono"
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.2em",
                    textTransform: "uppercase",
                    height: 32,
                    padding: "0 10px",
                  }}
                >
                  <Share2 className="h-3 w-3" aria-hidden="true" /> Partager
                </button>
              }
            />
            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 22,
                fontWeight: 900,
                color: "var(--fg-1)",
                margin: 0,
              }}
            >
              {topLift.exercise_name}
            </p>
            <p
              className="stat-num gold"
              style={{ fontSize: 36, lineHeight: 1.1, marginTop: 8 }}
            >
              {topLift.weight_kg} kg × {topLift.reps_done}
            </p>
            <p
              className="mono"
              style={{
                fontSize: 10,
                color: "var(--fg-5)",
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                marginTop: 6,
              }}
            >
              RPE {topLift.rpe_felt}/10 · 1RM estimé {Math.round(topLift.weight_kg * (1 + topLift.reps_done / 30))} kg
            </p>
          </HudCard>
        );
      })()}

      {/* CTA retour */}
      <div className="flex justify-center pt-4">
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="btn btn-primary"
          style={{ minWidth: 240, height: 48 }}
        >
          Retour au tableau
        </button>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  delta,
  icon,
  accent,
}: {
  label: string;
  value: string;
  delta?: number;
  icon?: React.ReactNode;
  accent: "gold" | "tech";
}) {
  const valueColor = accent === "tech" ? "var(--accent-tech)" : "var(--gold-400)";
  return (
    <HudCard accent={accent} chamfer="sm" corners style={{ padding: "0.85rem 1rem" }}>
      <div className="flex items-center justify-between mb-2">
        <span
          className="mono"
          style={{
            fontSize: 9,
            letterSpacing: "0.3em",
            color: "var(--fg-4)",
            textTransform: "uppercase",
          }}
        >
          {label}
        </span>
        {icon}
      </div>
      <div className="stat-num" style={{ fontSize: 24, lineHeight: 1, color: valueColor }}>
        {value}
      </div>
      {delta !== undefined && delta !== 0 && (
        <span
          className="mono"
          style={{
            fontSize: 9,
            letterSpacing: "0.1em",
            color: delta > 0 ? "var(--accent-tech)" : "var(--alert-500)",
            marginTop: 4,
            display: "inline-block",
          }}
        >
          {delta > 0 ? "+" : ""}
          {delta}% vs précédente
        </span>
      )}
    </HudCard>
  );
}

function findTopLift(session: SessionDoc) {
  let bestE1rm = 0;
  let best: { exercise_name: string; weight_kg: number; reps_done: number; rpe_felt: number } | undefined;
  for (const ex of session.exercises) {
    for (const set of ex.sets_logged) {
      const load = (set.weight_kg ?? 0) + (set.loaded_kg ?? 0);
      if (load <= 0) continue;
      const e1rm = load * (1 + set.reps_done / 30);
      if (e1rm > bestE1rm) {
        bestE1rm = e1rm;
        best = {
          exercise_name: ex.exercise_name,
          weight_kg: load,
          reps_done: set.reps_done,
          rpe_felt: set.rpe_felt,
        };
      }
    }
  }
  return best;
}

function formatVolume(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)} t`;
  return `${kg.toLocaleString("fr-FR")} kg`;
}
