/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/firebase/hooks";
import { Loader } from "@/components/ui/loader";
import { HudCard, PanelHeader, Tag, Corners } from "@/components/nodream";
import {
  Square,
  Check,
  ChevronRight,
  Minus,
  Plus,
  Volume2,
  VolumeX,
  Activity,
  TimerReset,
  Flame,
  Droplets,
} from "lucide-react";
import type { SessionDoc, ExerciseSlot, SetLog } from "@/types/session";
import { findExerciseById } from "@/lib/features/exercises";

/**
 * Page /session/live/[sessionId] — Focus mode tactical UI.
 *
 * Layout reproduit le screen NoDream Tactical OS :
 * - Bandeau header [SESSION-LIVE · CODE] avec stats DURÉE / VOLUME / EXOS / PROG
 * - Card exercice en cours (2/3) : tags, mini "DERNIÈRE", 3 boutons SET, 3 steppers, bouton VALIDER
 * - Sidebar (1/3) : Bio placeholder + ORACLE.IA audio + Stats Session live
 * - File d'exécution (queue full-width) avec block_code A1/A2/B1/...
 *
 * Realtime via onSnapshot — toute écriture API se reflète en temps réel.
 */

export default function LiveSessionPage() {
  const { user, loading, getFreshToken } = useAuth();
  const router = useRouter();
  const params = useParams();
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<SessionDoc | null>(null);
  const [fetching, setFetching] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Live execution state
  const [activeExerciseIdx, setActiveExerciseIdx] = useState(0);
  const [activeSetIdx, setActiveSetIdx] = useState(0); // 0-indexed, displayed as +1
  const [weight, setWeight] = useState(0);
  const [reps, setReps] = useState(0);
  const [rpe, setRpe] = useState(8);
  const [submitting, setSubmitting] = useState(false);

  // Rest timer
  const [restRemainingSec, setRestRemainingSec] = useState<number | null>(null);

  // Live duration tick
  const [nowMs, setNowMs] = useState(Date.now());

  // Audio coaching
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  // Subscribe to session doc
  useEffect(() => {
    if (loading || !user || !sessionId) return;
    const ref = doc(db, "users", user.uid, "workout_sessions", sessionId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setErr("Session introuvable");
          setFetching(false);
          return;
        }
        const data = snap.data() as SessionDoc;
        setSession({ ...data, id: snap.id });
        setFetching(false);
      },
      (e) => {
        console.error("[session/live] snapshot error:", e);
        setErr(e.message);
        setFetching(false);
      },
    );
    return () => unsub();
  }, [user, loading, sessionId]);

  // Init steppers from active exercise + last performance OR default
  useEffect(() => {
    if (!session) return;
    const ex = session.exercises[activeExerciseIdx];
    if (!ex) return;

    // Use last_performance as starting point, fallback to 0
    const last = ex.last_performance;
    if (last && weight === 0 && reps === 0) {
      setWeight(last.weight_kg);
      setReps(last.reps_done);
      setRpe(ex.target_rpe ?? 8);
    } else if (weight === 0 && reps === 0) {
      setReps(parseTargetReps(ex.target_reps_range));
      setRpe(ex.target_rpe ?? 8);
    }
  }, [session, activeExerciseIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live clock tick (every 1s)
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Wave 6 Pile 3 #11 — Screen Wake Lock so the phone doesn't sleep mid-set.
  // Released automatically when the component unmounts. Best-effort only —
  // Safari ≤16.4 doesn't expose the API.
  // M7 fix : `WakeLockSentinel` may not be in lib.dom.d.ts on older TS targets
  // — type as any to avoid compile errors across configs.
  useEffect(() => {
    let wakeLock: any = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        if (typeof navigator !== "undefined" && "wakeLock" in navigator) {
          wakeLock = await (navigator as any).wakeLock.request("screen");
          if (cancelled) {
            await wakeLock?.release();
            wakeLock = null;
          }
        }
      } catch (e) {
        // User can deny / battery saver may block; non-blocking
        console.warn("[session/live] wakeLock request failed:", e);
      }
    };
    void acquire();
    // Re-acquire on visibility change (iOS releases on backgrounding)
    const onVisibility = () => {
      if (document.visibilityState === "visible" && !wakeLock) void acquire();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void wakeLock?.release();
    };
  }, []);

  // Rest timer countdown
  useEffect(() => {
    if (restRemainingSec === null) return;
    if (restRemainingSec <= 0) {
      // Dynamic cue for the next set focus + auto-clear
      const ex = session?.exercises[activeExerciseIdx];
      if (ex) {
        void speakCoachDynamic(
          "rest_end",
          {
            exercise_id: ex.exercise_id,
            exercise_name: ex.exercise_name,
            set_index: activeSetIdx + 1,
            target_sets: ex.target_sets,
            target_reps_range: ex.target_reps_range,
            target_rpe: ex.target_rpe,
            last_performance: ex.last_performance,
          },
          "Repos terminé. Prépare la prochaine série.",
        );
      } else {
        void speakCoach("Repos terminé. Prépare la prochaine série.");
      }
      setRestRemainingSec(null);
      return;
    }
    const id = setTimeout(() => setRestRemainingSec((s) => (s === null ? null : s - 1)), 1000);
    return () => clearTimeout(id);
  }, [restRemainingSec]); // eslint-disable-line react-hooks/exhaustive-deps

  // Audio unlock — must be triggered by user gesture (iOS PWA constraint)
  const unlockAudio = useCallback(async () => {
    if (audioUnlocked) return;
    try {
      const a = new Audio(
        "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=",
      );
      await a.play();
      audioElRef.current = a;
      setAudioUnlocked(true);
    } catch (e) {
      console.warn("[audio] unlock failed:", e);
    }
  }, [audioUnlocked]);

  const speakCoach = useCallback(
    async (text: string) => {
      if (audioMuted || !audioUnlocked) return;
      try {
        const token = await getFreshToken();
        if (!token) return;
        const res = await fetch("/api/ai/coach-audio", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ text }),
        });
        if (!res.ok) {
          console.warn("[audio] coach-audio failed:", res.status);
          return;
        }
        const blob = await res.blob();
        if (audioElRef.current) {
          audioElRef.current.src = URL.createObjectURL(blob);
          await audioElRef.current.play();
        }
      } catch (e) {
        console.warn("[audio] speak failed:", e);
      }
    },
    [audioMuted, audioUnlocked, getFreshToken],
  );

  /**
   * Generate a dynamic coaching cue via /api/ai/coach-session-cue then play
   * it via /api/ai/coach-audio. Falls back to the provided default text if
   * the cue generation fails (e.g. rate-limited).
   */
  const speakCoachDynamic = useCallback(
    async (
      trigger: "set_start" | "set_finish" | "rest_start" | "rest_end" | "session_start",
      payload: {
        exercise_id: string;
        exercise_name: string;
        set_index?: number;
        target_sets?: number;
        target_reps_range?: string;
        target_rpe?: number;
        weight_kg?: number;
        reps_done?: number;
        rpe_felt?: number;
        last_performance?: { weight_kg: number; reps_done: number; rpe_felt: number; days_ago: number };
      },
      fallbackText?: string,
    ) => {
      if (audioMuted || !audioUnlocked) return;
      try {
        const token = await getFreshToken();
        if (!token) return;
        const res = await fetch("/api/ai/coach-session-cue", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ ...payload, trigger }),
        });
        const data = await res.json();
        const text = res.ok ? (data?.text as string | undefined) : fallbackText;
        if (text) await speakCoach(text);
      } catch (e) {
        console.warn("[cue] dynamic failed, falling back:", e);
        if (fallbackText) await speakCoach(fallbackText);
      }
    },
    [audioMuted, audioUnlocked, getFreshToken, speakCoach],
  );

  // Submit a set log
  const handleValidateSet = async () => {
    if (!session || submitting) return;
    const ex = session.exercises[activeExerciseIdx];
    if (!ex) return;
    setSubmitting(true);
    setErr(null);
    try {
      const token = await getFreshToken();
      if (!token) throw new Error("Auth requise");
      const res = await fetch(`/api/sessions/${sessionId}/log-set`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          exercise_id: ex.exercise_id,
          set_index: activeSetIdx + 1,
          weight_kg: weight,
          reps_done: reps,
          rpe_felt: rpe,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "log_set_failed");

      // Trigger rest timer + dynamic ORACLE.IA cue
      setRestRemainingSec(ex.rest_seconds);
      void speakCoachDynamic(
        "set_finish",
        {
          exercise_id: ex.exercise_id,
          exercise_name: ex.exercise_name,
          set_index: activeSetIdx + 1,
          target_sets: ex.target_sets,
          target_reps_range: ex.target_reps_range,
          target_rpe: ex.target_rpe,
          weight_kg: weight,
          reps_done: reps,
          rpe_felt: rpe,
          last_performance: ex.last_performance,
        },
        `Série validée. ${reps} répétitions, RPE ${rpe}. Repos ${ex.rest_seconds} secondes.`,
      );

      // Auto-advance to next set OR next exercise
      if (activeSetIdx + 1 >= ex.target_sets) {
        // Move to next exercise (or wrap to current if last)
        const next = activeExerciseIdx + 1;
        if (next < session.exercises.length) {
          setActiveExerciseIdx(next);
          setActiveSetIdx(0);
          setWeight(0); // forces re-init from last_performance
          setReps(0);
        } else {
          // All done — prompt finish
          void speakCoach("Dernière série bouclée. Termine la séance pour valider.");
        }
      } else {
        setActiveSetIdx(activeSetIdx + 1);
      }
    } catch (e: any) {
      setErr(e?.message ?? "Erreur lors de l'enregistrement");
    } finally {
      setSubmitting(false);
    }
  };

  const [showAbortModal, setShowAbortModal] = useState(false);

  const handleAbort = async () => {
    setShowAbortModal(true);
  };

  const confirmAbort = async () => {
    setShowAbortModal(false);
    try {
      const token = await getFreshToken();
      if (!token) return;
      await fetch(`/api/sessions/${sessionId}/abort`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: "user_abort" }),
      });
      router.push("/dashboard");
    } catch (e) {
      console.error("[abort] failed:", e);
    }
  };

  const handleFinish = async () => {
    try {
      const token = await getFreshToken();
      if (!token) return;
      const res = await fetch(`/api/sessions/${sessionId}/finish`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        // Wave 6C : fire-and-forget proactive session_finished trigger.
        // Adds a debrief message to /coach inbox + marks badge on dashboard.
        // Doesn't block redirect to summary (where the session-debrief
        // route is also called for the immediate display).
        void fetch("/api/coach/proactive", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ trigger: "session_finished" }),
        }).catch((e) => console.warn("[proactive] session_finished failed:", e));
        router.push("/workout/summary?from=" + sessionId);
      }
    } catch (e) {
      console.error("[finish] failed:", e);
    }
  };

  if (loading || fetching) {
    return <Loader size="fullscreen" message="Chargement de la séance..." />;
  }

  if (err || !session) {
    return (
      <div className="flex-1 flex items-center justify-center px-6 py-10">
        <HudCard accent="tech" chamfer="sm" style={{ padding: "1.5rem", maxWidth: 480 }}>
          <PanelHeader code="ERR-SESSION" title="Session indisponible" accent="tech" />
          <p style={{ fontSize: 12, color: "var(--fg-3)", margin: "0 0 16px 0" }}>
            {err ?? "Impossible de charger la session."}
          </p>
          <button onClick={() => router.push("/session")} className="btn btn-primary" style={{ width: "100%" }}>
            Retour au sélecteur
          </button>
        </HudCard>
      </div>
    );
  }

  const activeExo = session.exercises[activeExerciseIdx];
  const exoMeta = findExerciseById(activeExo?.exercise_id ?? "");
  const completionPct = session.metrics.completion_pct;
  const durationSec = Math.floor((nowMs - new Date(session.started_at).getTime()) / 1000);
  const allDone = session.exercises.every((ex) => ex.sets_logged.length >= ex.target_sets);

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-6 space-y-4">
      {/* Header bandeau */}
      <HudCard accent="tech" chamfer="sm" style={{ padding: "0.85rem 1.25rem", position: "relative", overflow: "hidden" }}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <span
              className="mono flex items-center gap-2"
              style={{ fontSize: 10, letterSpacing: "0.3em", color: "var(--alert-500)", textTransform: "uppercase" }}
            >
              <span
                className="status-dot"
                style={{ background: "var(--alert-500)", boxShadow: "0 0 10px var(--alert-500)" }}
                aria-hidden="true"
              />
              SESSION-LIVE · {session.session_code}
            </span>
            <h2
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 22,
                fontWeight: 900,
                letterSpacing: "-0.01em",
                color: "var(--fg-1)",
                margin: "4px 0 0 0",
                textTransform: "uppercase",
              }}
            >
              Opération : <span style={{ color: "var(--gold-400)" }}>{session.operation_name}</span>
            </h2>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <StatBlock label="Durée" value={formatDuration(durationSec)} accent="tech" />
            <StatBlock label="Volume" value={formatVolume(session.metrics.volume_kg)} accent="tech" />
            <StatBlock
              label="Exos"
              value={`${session.exercises.filter((e) => e.sets_logged.length >= e.target_sets).length}/${session.exercises.length}`}
              accent="tech"
            />
            <StatBlock label="Prog" value={`${completionPct}%`} accent="gold" />
            <button
              onClick={handleAbort}
              className="mono cursor-pointer"
              style={{
                padding: "8px 14px",
                background: "var(--alert-tint-15)",
                color: "var(--alert-500)",
                border: "1px solid var(--alert-500)",
                fontSize: 10,
                letterSpacing: "0.2em",
                fontWeight: 700,
                textTransform: "uppercase",
                clipPath:
                  "polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Square className="h-3 w-3" aria-hidden="true" /> Abandonner
            </button>
          </div>
        </div>
        {/* Progress bar at bottom of header */}
        <div
          style={{
            position: "absolute",
            left: 0,
            bottom: 0,
            height: 3,
            width: `${completionPct}%`,
            background: "var(--accent-tech)",
            boxShadow: "0 0 10px var(--accent-tech)",
            transition: "width 300ms ease",
          }}
          aria-hidden="true"
        />
      </HudCard>

      {/* Rest banner if rest timer active */}
      {restRemainingSec !== null && restRemainingSec > 0 && (
        <HudCard accent="gold" chamfer="sm" style={{ padding: "0.75rem 1rem" }}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <TimerReset className="h-5 w-5" style={{ color: "var(--gold-400)" }} aria-hidden="true" />
              <span
                className="mono"
                style={{ fontSize: 10, letterSpacing: "0.3em", color: "var(--gold-500)", textTransform: "uppercase" }}
              >
                [REPOS · EN COURS]
              </span>
            </div>
            <span
              className="stat-num gold"
              style={{ fontSize: 28, lineHeight: 1, fontFamily: "var(--font-mono-display, var(--font-mono))" }}
            >
              {formatDuration(restRemainingSec)}
            </span>
            <button
              onClick={() => setRestRemainingSec(null)}
              className="btn btn-ghost mono"
              style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase" }}
            >
              Passer
            </button>
          </div>
        </HudCard>
      )}

      {/* Main grid : exercice en cours (2/3) + sidebar (1/3) */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* LEFT: Exercice en cours */}
        <div className="lg:col-span-2">
          {activeExo ? (
            <HudCard accent="gold" chamfer="sm" style={{ padding: "1rem 1.25rem" }}>
              {/* Header exo */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <span
                    className="mono flex items-center gap-2"
                    style={{ fontSize: 10, letterSpacing: "0.3em", color: "var(--gold-500)" }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--gold-400)" }} />
                    EXERCICE EN COURS · [{activeExo.block_code}]
                  </span>
                  <h3
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: 26,
                      fontWeight: 900,
                      color: "var(--fg-1)",
                      margin: "6px 0 8px 0",
                    }}
                  >
                    {activeExo.exercise_name}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    <Tag accent="gold">
                      Série {activeSetIdx + 1} / {activeExo.target_sets}
                    </Tag>
                    <Tag accent="tech">Cible : {activeExo.target_reps_range} reps</Tag>
                    <Tag accent="dim">RPE {activeExo.target_rpe}</Tag>
                  </div>
                </div>

                {/* Mini "DERNIÈRE" */}
                {activeExo.last_performance && (
                  <div
                    style={{
                      padding: 10,
                      minWidth: 120,
                      textAlign: "right",
                      background: "var(--gold-tint-08)",
                      border: "1px solid var(--gold-tint-25)",
                      clipPath:
                        "polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)",
                    }}
                  >
                    <span className="eyebrow" style={{ display: "block" }}>
                      Dernière
                    </span>
                    <div
                      className="mono"
                      style={{ fontSize: 15, color: "var(--gold-400)", fontWeight: 700, marginTop: 4 }}
                    >
                      {activeExo.last_performance.weight_kg}kg × {activeExo.last_performance.reps_done}
                    </div>
                    <div
                      className="mono"
                      style={{ fontSize: 9, color: "var(--fg-5)", marginTop: 2, letterSpacing: "0.1em" }}
                    >
                      RPE {activeExo.last_performance.rpe_felt} · il y a {activeExo.last_performance.days_ago}j
                    </div>
                  </div>
                )}
              </div>

              {/* 3 SET buttons (current/done/future) */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {Array.from({ length: activeExo.target_sets }).map((_, idx) => {
                  const done = idx < activeExo.sets_logged.length;
                  const active = idx === activeSetIdx;
                  return (
                    <button
                      key={idx}
                      onClick={() => setActiveSetIdx(idx)}
                      className="mono cursor-pointer transition-all"
                      style={{
                        padding: "12px",
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: "0.2em",
                        textTransform: "uppercase",
                        background: done
                          ? "var(--accent-tech-tint)"
                          : active
                            ? "var(--gold-tint-15)"
                            : "var(--glass-bg-2)",
                        color: done
                          ? "var(--accent-tech)"
                          : active
                            ? "var(--gold-400)"
                            : "var(--fg-5)",
                        border: `1px solid ${done ? "var(--accent-tech)" : active ? "var(--gold-tint-35)" : "var(--glass-border)"}`,
                        boxShadow: active ? "var(--glow-gold-soft)" : "none",
                        clipPath:
                          "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                      }}
                      aria-pressed={active}
                    >
                      Set {idx + 1}
                      {done ? <Check className="h-3 w-3" aria-hidden="true" /> : active ? <ChevronRight className="h-3 w-3" aria-hidden="true" /> : null}
                    </button>
                  );
                })}
              </div>

              {/* 3 Steppers : charge / reps / RPE */}
              <div className="grid grid-cols-3 gap-2">
                <Stepper
                  label="Charge"
                  value={weight}
                  unit="kg"
                  step={2.5}
                  onChange={setWeight}
                  accent="gold"
                />
                <Stepper
                  label="Répétitions"
                  value={reps}
                  unit="reps"
                  step={1}
                  onChange={setReps}
                  accent="gold"
                />
                <Stepper
                  label="RPE ressenti"
                  value={rpe}
                  unit="/10"
                  step={1}
                  min={1}
                  max={10}
                  onChange={setRpe}
                  accent="tech"
                />
              </div>

              {/* Validate button */}
              <button
                onClick={handleValidateSet}
                disabled={submitting || reps === 0}
                className="btn btn-tech mt-4"
                style={{ width: "100%", height: 52, fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 700 }}
              >
                {submitting ? (
                  <>Validation...</>
                ) : (
                  <>
                    <Check className="h-4 w-4" aria-hidden="true" />
                    Valider la série → Repos {activeExo.rest_seconds}s
                  </>
                )}
              </button>

              {/* Cues techniques (collapsible info) */}
              {exoMeta && exoMeta.cues_technique.length > 0 && (
                <details
                  style={{
                    marginTop: 14,
                    padding: 10,
                    background: "var(--glass-bg-2)",
                    border: "1px solid var(--glass-border)",
                    clipPath:
                      "polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)",
                  }}
                >
                  <summary
                    className="mono cursor-pointer"
                    style={{ fontSize: 10, color: "var(--fg-4)", letterSpacing: "0.2em", textTransform: "uppercase" }}
                  >
                    [CUES-TECH] · Voir consignes
                  </summary>
                  <ul className="space-y-1" style={{ paddingLeft: 16, marginTop: 8 }}>
                    {exoMeta.cues_technique.map((cue, i) => (
                      <li key={i} style={{ fontSize: 11, color: "var(--fg-2)", lineHeight: 1.5 }}>
                        {cue}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </HudCard>
          ) : (
            <HudCard accent="tech" chamfer="sm" style={{ padding: "1.25rem" }}>
              <p className="mono text-center" style={{ fontSize: 11, color: "var(--fg-4)", letterSpacing: "0.1em" }}>
                Tous les exercices sont terminés. Termine la séance pour enregistrer.
              </p>
            </HudCard>
          )}
        </div>

        {/* RIGHT: Sidebar (ORACLE.IA audio + Stats) */}
        <div className="space-y-4 lg:col-span-1">
          {/* ORACLE.IA audio */}
          <HudCard accent="tech" chamfer="sm" style={{ padding: "0.85rem 1rem" }}>
            <div className="flex items-center justify-between mb-2">
              <span
                className="mono flex items-center gap-2"
                style={{ fontSize: 10, letterSpacing: "0.3em", color: "var(--accent-tech)", textTransform: "uppercase" }}
              >
                <span className="status-dot" aria-hidden="true" />
                ORACLE.IA · {audioUnlocked && !audioMuted ? "AUDIO ACTIF" : "AUDIO INACTIF"}
              </span>
              <button
                onClick={audioUnlocked ? () => setAudioMuted(!audioMuted) : unlockAudio}
                className="mono cursor-pointer"
                style={{
                  padding: "4px 8px",
                  background: audioMuted ? "var(--glass-bg-2)" : "var(--accent-tech-tint)",
                  color: audioMuted ? "var(--fg-5)" : "var(--accent-tech)",
                  border: `1px solid ${audioMuted ? "var(--glass-border)" : "var(--accent-tech)"}`,
                  fontSize: 9,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  clipPath:
                    "polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                {audioUnlocked && !audioMuted ? (
                  <>
                    <Volume2 className="h-3 w-3" aria-hidden="true" /> ON
                  </>
                ) : (
                  <>
                    <VolumeX className="h-3 w-3" aria-hidden="true" /> {audioUnlocked ? "OFF" : "Activer"}
                  </>
                )}
              </button>
            </div>
            <p
              style={{
                fontFamily: "var(--font-serif)",
                fontStyle: "italic",
                fontSize: 12,
                lineHeight: 1.5,
                color: "var(--fg-2)",
                margin: 0,
              }}
            >
              {audioUnlocked
                ? "ORACLE.IA en veille — les consignes audio s'activent à chaque validation de série."
                : "Active l'audio pour recevoir les consignes ORACLE.IA en temps réel."}
            </p>
          </HudCard>

          {/* Stats session live */}
          <HudCard accent="gold" chamfer="sm" style={{ padding: "0.85rem 1rem" }}>
            <PanelHeader
              code="STAT"
              title={
                <span className="flex items-center gap-2">
                  <Activity className="h-4 w-4" style={{ color: "var(--gold-400)" }} aria-hidden="true" />
                  Stats session
                </span>
              }
              accent="gold"
              right={<Tag accent="tech">LIVE</Tag>}
            />
            <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
              <StatRow label="Volume total" value={`${session.metrics.volume_kg} kg`} delta={session.metrics.vs_previous_volume_pct} />
              <StatRow label="Tonnage moyen / set" value={`${session.metrics.tonnage_avg_per_set_kg} kg`} />
              <StatRow label="Densité (set/min)" value={session.metrics.density_sets_per_min.toFixed(2)} />
              <StatRow label="Calories estimées" value={`${session.metrics.calories_est_kcal} kcal`} icon={<Flame className="h-3 w-3" style={{ color: "var(--gold-400)" }} aria-hidden="true" />} />
              <StatRow
                label="Eau consommée"
                value={`${session.metrics.water_consumed_l.toFixed(1)} / ${session.metrics.water_target_l} L`}
                icon={<Droplets className="h-3 w-3" style={{ color: "var(--accent-tech)" }} aria-hidden="true" />}
              />
            </ul>
          </HudCard>

          {/* Finish button if all done */}
          {allDone && (
            <button
              onClick={handleFinish}
              className="btn btn-primary"
              style={{ width: "100%", height: 48, fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 700 }}
            >
              <Check className="h-4 w-4" aria-hidden="true" />
              Terminer la séance
            </button>
          )}
        </div>
      </div>

      {/* File d'exécution */}
      <HudCard accent="gold" chamfer="sm" style={{ padding: "0.85rem 1rem" }}>
        <PanelHeader
          code="QUEUE"
          title="File d'exécution"
          accent="gold"
          right={<Tag accent="gold">{session.exercises.length} EXOS</Tag>}
        />
        <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {session.exercises.map((ex, idx) => (
            <QueueRow
              key={idx}
              slot={ex}
              isActive={idx === activeExerciseIdx}
              onClick={() => {
                setActiveExerciseIdx(idx);
                setActiveSetIdx(Math.min(ex.sets_logged.length, ex.target_sets - 1));
                setWeight(0);
                setReps(0);
              }}
            />
          ))}
        </ul>
      </HudCard>

      {/* Wave 6 Pile 3 #11 — NoDream-tactical abort modal */}
      {showAbortModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="abort-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{
            background: "rgba(6, 3, 15, 0.85)",
            backdropFilter: "blur(6px)",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowAbortModal(false); }}
        >
          <HudCard accent="tech" chamfer="sm" style={{ padding: "1.25rem 1.5rem", maxWidth: 460, width: "100%" }}>
            <PanelHeader
              code="CONFIRM-ABORT"
              title={
                <span id="abort-modal-title" className="flex items-center gap-2">
                  <Square className="h-4 w-4" style={{ color: "var(--alert-500)" }} aria-hidden="true" />
                  Abandonner la session ?
                </span>
              }
              accent="tech"
            />
            <p
              style={{
                fontSize: 13,
                color: "var(--fg-2)",
                lineHeight: 1.55,
                margin: "0 0 18px 0",
              }}
            >
              Les séries déjà loggées seront <strong style={{ color: "var(--fg-1)" }}>conservées</strong>.
              La session sera marquée <em>aborted</em>, le coach ne générera pas de debrief automatique.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowAbortModal(false)}
                className="btn btn-ghost mono flex-1"
                style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase" }}
              >
                Annuler
              </button>
              <button
                onClick={confirmAbort}
                className="mono cursor-pointer flex-1"
                style={{
                  padding: "10px 14px",
                  background: "var(--alert-500)",
                  color: "var(--ink-900)",
                  border: "1px solid var(--alert-500)",
                  fontSize: 10,
                  letterSpacing: "0.2em",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  clipPath:
                    "polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <Square className="h-3 w-3" aria-hidden="true" /> Confirmer l&apos;abandon
              </button>
            </div>
          </HudCard>
        </div>
      )}
    </div>
  );
}

// =========================================
// Sub-components
// =========================================

function StatBlock({ label, value, accent }: { label: string; value: string; accent: "gold" | "tech" }) {
  const color = accent === "tech" ? "var(--accent-tech)" : "var(--gold-400)";
  return (
    <div style={{ minWidth: 60 }}>
      <span className="mono" style={{ fontSize: 9, color: "var(--fg-5)", letterSpacing: "0.2em", textTransform: "uppercase" }}>
        {label}
      </span>
      <div className="mono" style={{ fontSize: 18, color, fontWeight: 700, letterSpacing: "0.02em", marginTop: 2 }}>
        {value}
      </div>
    </div>
  );
}

interface StepperProps {
  label: string;
  value: number;
  unit: string;
  step: number;
  min?: number;
  max?: number;
  accent?: "gold" | "tech";
  onChange: (v: number) => void;
}

function Stepper({ label, value, unit, step, min = 0, max = 999, accent = "gold", onChange }: StepperProps) {
  const color = accent === "tech" ? "var(--accent-tech)" : "var(--gold-400)";
  return (
    <div
      style={{
        padding: 10,
        background: "var(--glass-bg-2)",
        border: "1px solid var(--glass-border)",
        clipPath:
          "polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)",
        position: "relative",
      }}
    >
      <Corners accent={accent === "tech" ? "tech" : "gold"} />
      <span
        className="mono block text-center"
        style={{ fontSize: 9, color: "var(--fg-4)", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 6 }}
      >
        {label}
      </span>
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => onChange(Math.max(min, value - step))}
          className="mono cursor-pointer flex items-center justify-center"
          style={{
            width: 36,
            height: 36,
            background: "var(--gold-tint-08)",
            border: "1px solid var(--gold-tint-25)",
            color: "var(--gold-400)",
            clipPath:
              "polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)",
          }}
          aria-label={`Diminuer ${label}`}
        >
          <Minus className="h-4 w-4" aria-hidden="true" />
        </button>
        <div className="flex-1 text-center">
          <span
            className="mono tabular-nums"
            style={{ fontSize: 28, color, fontWeight: 700, letterSpacing: "0.02em", display: "block", lineHeight: 1 }}
          >
            {value}
          </span>
          <span className="mono" style={{ fontSize: 9, color: "var(--fg-5)", letterSpacing: "0.15em", textTransform: "uppercase" }}>
            {unit}
          </span>
        </div>
        <button
          onClick={() => onChange(Math.min(max, value + step))}
          className="mono cursor-pointer flex items-center justify-center"
          style={{
            width: 36,
            height: 36,
            background: "var(--gold-tint-08)",
            border: "1px solid var(--gold-tint-25)",
            color: "var(--gold-400)",
            clipPath:
              "polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)",
          }}
          aria-label={`Augmenter ${label}`}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function StatRow({ label, value, delta, icon }: { label: string; value: string; delta?: number; icon?: React.ReactNode }) {
  return (
    <li
      className="flex justify-between items-center"
      style={{ padding: "8px 0", borderBottom: "1px solid var(--glass-border)", fontSize: 11 }}
    >
      <span className="mono flex items-center gap-2" style={{ color: "var(--fg-3)", letterSpacing: "0.05em" }}>
        {icon}
        {label}
      </span>
      <span className="flex items-center gap-2">
        <span className="mono tabular-nums" style={{ color: "var(--gold-400)", fontWeight: 700 }}>
          {value}
        </span>
        {delta !== undefined && delta !== 0 && (
          <span
            className="mono"
            style={{
              fontSize: 9,
              color: delta > 0 ? "var(--accent-tech)" : "var(--alert-500)",
              letterSpacing: "0.05em",
            }}
          >
            {delta > 0 ? "+" : ""}
            {delta}% vs dern.
          </span>
        )}
      </span>
    </li>
  );
}

function QueueRow({
  slot,
  isActive,
  onClick,
}: {
  slot: ExerciseSlot;
  isActive: boolean;
  onClick: () => void;
}) {
  const done = slot.sets_logged.length >= slot.target_sets;
  const partialReps = slot.sets_logged.length;
  return (
    <li
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick();
      }}
      className="flex items-center gap-3 cursor-pointer"
      style={{
        padding: "10px 14px",
        borderBottom: "1px solid var(--glass-border)",
        background: isActive ? "var(--gold-tint-08)" : "transparent",
        borderLeft: isActive ? "3px solid var(--gold-400)" : "3px solid transparent",
        borderRight: isActive ? "3px solid var(--gold-400)" : "3px solid transparent",
        opacity: done ? 0.5 : 1,
        transition: "all 150ms ease",
      }}
    >
      <span
        className="mono"
        style={{
          fontSize: 10,
          width: 16,
          color: done ? "var(--accent-tech)" : isActive ? "var(--gold-400)" : "var(--fg-5)",
          fontWeight: 700,
        }}
        aria-hidden="true"
      >
        {done ? "✓" : isActive ? "▶" : "▸"}
      </span>
      <span
        className="mono"
        style={{
          fontSize: 10,
          color: isActive ? "var(--gold-400)" : "var(--fg-4)",
          letterSpacing: "0.15em",
          fontWeight: 700,
          width: 28,
        }}
      >
        {slot.block_code}
      </span>
      <span
        className="flex-1"
        style={{
          fontSize: 13,
          color: isActive ? "var(--fg-1)" : "var(--fg-3)",
          fontWeight: isActive ? 700 : 500,
          textDecoration: done ? "line-through" : "none",
        }}
      >
        {slot.exercise_name}
      </span>
      <span
        className="mono tabular-nums"
        style={{ fontSize: 10, color: "var(--fg-5)", letterSpacing: "0.05em" }}
      >
        {partialReps > 0 ? `${partialReps}/${slot.target_sets}` : slot.target_sets}×{slot.target_reps_range}
      </span>
    </li>
  );
}

// =========================================
// Helpers
// =========================================

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function formatVolume(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}t`;
  return `${kg}kg`;
}

function parseTargetReps(range: string): number {
  // "8-12" → midpoint 10; "5" → 5; "AMRAP" → 0; "30s" → 0
  if (!range) return 0;
  const m = range.match(/(\d+)\s*-\s*(\d+)/);
  if (m) return Math.round((parseInt(m[1]) + parseInt(m[2])) / 2);
  const single = range.match(/^(\d+)$/);
  if (single) return parseInt(single[1]);
  return 0;
}
