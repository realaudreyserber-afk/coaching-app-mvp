/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { doc, getDoc, collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/firebase/hooks";
import { Loader } from "@/components/ui/loader";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { HudCard, PanelHeader, Tag, Corners } from "@/components/nodream";
import {
  Plus,
  Minus,
  Check,
  ChevronRight,
  Square,
  Activity,
  Flame,
  Save,
  TimerReset,
} from "lucide-react";
import type { PlanDoc, PlanTrainingSession } from "@/types/plan";

/**
 * Page /session/log/[planId]?block=N — UX tactical OS local-first.
 *
 * Pivot post-séance type Strong/Hevy : toute la séance est en state React
 * pendant l'exécution (zéro write Firestore live). Un seul POST à la fin
 * vers /api/sessions/log-full qui écrit tout en 1 batch — pas de risque
 * d'undefined rejeté par Firestore Admin SDK.
 *
 * Le UX visuel (header compteurs live, boutons SET, steppers gros, stats
 * card live, file d'exécution avec block_code) est conservé depuis l'ancien
 * /session/live mais avec la robustesse du pattern industrie.
 */

interface LocalSet {
  weight_kg: number;
  reps_done: number;
  rpe_felt: number;
  completed: boolean;
}

interface LocalExercise {
  exercise_id: string;
  exercise_name: string;
  target_sets: number;
  target_reps_range: string;
  target_rest_seconds: number;
  block_code: string;
  superset_group?: string;
  sets: LocalSet[];
}

function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Block code (A1, A2, B1, ...) — duplication light de la logique dans
 * /api/sessions/start (Wave 7 #8). Cf. start/route.ts:190 pour la version
 * canonique côté serveur.
 */
function buildBlockCode(
  idx: number,
  all: ReadonlyArray<{ superset_group?: string }>,
): string {
  const hasAnySupersetGroup = all.some(
    (e) => typeof e.superset_group === "string" && e.superset_group,
  );

  if (hasAnySupersetGroup) {
    const groupLetters = new Map<string, string>();
    const soloLetters = new Map<number, string>();
    let nextLetterCode = "A".charCodeAt(0);
    for (let i = 0; i < all.length; i++) {
      const g = all[i].superset_group;
      if (g) {
        if (!groupLetters.has(g)) {
          groupLetters.set(g, String.fromCharCode(nextLetterCode++));
        }
      } else {
        soloLetters.set(i, String.fromCharCode(nextLetterCode++));
      }
    }
    const me = all[idx];
    const letter = me.superset_group
      ? groupLetters.get(me.superset_group)!
      : soloLetters.get(idx)!;
    let slot = 1;
    if (me.superset_group) {
      for (let i = 0; i < idx; i++) {
        if (all[i].superset_group === me.superset_group) slot++;
      }
    }
    return `${letter}${slot}`;
  }

  // Fallback paires-de-2 (A1/A2, B1/B2, ...)
  const blockLetter = String.fromCharCode("A".charCodeAt(0) + Math.floor(idx / 2));
  const slot = (idx % 2) + 1;
  return `${blockLetter}${slot}`;
}

function parseTargetRepsLow(range: string): number {
  if (!range) return 10;
  const m = range.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 10;
}

function formatDuration(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

// ────────────────────────────────────────────────────────────────
// Stepper component — utilisé pour CHARGE / RÉPÉTITIONS / RPE
// ────────────────────────────────────────────────────────────────

interface StepperProps {
  label: string;
  unit?: string;
  value: number;
  step: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
  decimals?: number;
}

function Stepper({ label, unit, value, step, min, max, onChange, decimals = 0 }: StepperProps) {
  // Audit UX 2026-05-28 : incrément fixe à +2.5 kg = 40 clics pour aller à 100 kg.
  // Fix : long-press (>=500ms) déclenche un repeat accéléré (1 step / 80ms).
  // De plus, après ~2s, on passe à step×4 pour aller VRAIMENT vite sur les
  // charges élevées sans configurer manuellement.
  const valueRef = useRef(value);
  valueRef.current = value;
  const repeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fastStepRef = useRef(step);

  const stopRepeat = () => {
    if (repeatTimerRef.current) {
      clearInterval(repeatTimerRef.current);
      repeatTimerRef.current = null;
    }
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (accelTimerRef.current) {
      clearTimeout(accelTimerRef.current);
      accelTimerRef.current = null;
    }
    fastStepRef.current = step;
  };

  const applyDelta = (delta: number) => {
    const next = +(valueRef.current + delta).toFixed(decimals);
    onChange(Math.max(min, Math.min(max, next)));
  };

  const startHold = (dir: -1 | 1) => {
    // Single click immédiat
    applyDelta(dir * step);
    // Long-press : après 500ms, repeat ; après 2s, accélération
    longPressTimerRef.current = setTimeout(() => {
      fastStepRef.current = step;
      repeatTimerRef.current = setInterval(() => {
        applyDelta(dir * fastStepRef.current);
      }, 80);
      accelTimerRef.current = setTimeout(() => {
        fastStepRef.current = step * 4;
      }, 2000);
    }, 500);
  };

  return (
    <div
      style={{
        background: "var(--glass-bg-2)",
        border: "1px solid var(--glass-border)",
        padding: "8px 6px 10px",
        clipPath:
          "polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)",
      }}
    >
      <div
        className="mono"
        style={{
          fontSize: 9,
          letterSpacing: "0.2em",
          color: "var(--fg-5)",
          textAlign: "center",
          textTransform: "uppercase",
          fontWeight: 700,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div className="flex items-center justify-between gap-1">
        <button
          type="button"
          onMouseDown={() => startHold(-1)}
          onMouseUp={stopRepeat}
          onMouseLeave={stopRepeat}
          onTouchStart={() => startHold(-1)}
          onTouchEnd={stopRepeat}
          onTouchCancel={stopRepeat}
          aria-label={`Diminuer ${label} (maintenir pour accélérer)`}
          className="mono cursor-pointer"
          style={{
            width: 28,
            height: 32,
            background: "var(--glass-bg-2)",
            border: "1px solid var(--glass-border)",
            color: "var(--gold-400)",
            clipPath:
              "polygon(3px 0, 100% 0, 100% calc(100% - 3px), calc(100% - 3px) 100%, 0 100%, 0 3px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Minus className="h-3 w-3" aria-hidden="true" />
        </button>
        <div
          className="mono"
          style={{
            flex: 1,
            textAlign: "center",
            fontSize: 22,
            fontWeight: 900,
            color: "var(--fg-1)",
            lineHeight: 1,
          }}
        >
          {value.toFixed(decimals)}
        </div>
        <button
          type="button"
          onMouseDown={() => startHold(1)}
          onMouseUp={stopRepeat}
          onMouseLeave={stopRepeat}
          onTouchStart={() => startHold(1)}
          onTouchEnd={stopRepeat}
          onTouchCancel={stopRepeat}
          aria-label={`Augmenter ${label} (maintenir pour accélérer)`}
          className="mono cursor-pointer"
          style={{
            width: 28,
            height: 32,
            background: "var(--glass-bg-2)",
            border: "1px solid var(--glass-border)",
            color: "var(--gold-400)",
            clipPath:
              "polygon(3px 0, 100% 0, 100% calc(100% - 3px), calc(100% - 3px) 100%, 0 100%, 0 3px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Plus className="h-3 w-3" aria-hidden="true" />
        </button>
      </div>
      {unit && (
        <div
          className="mono"
          style={{
            fontSize: 8,
            color: "var(--fg-5)",
            textAlign: "center",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            marginTop: 2,
          }}
        >
          {unit}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Page principale
// ────────────────────────────────────────────────────────────────

/**
 * Audit 2026-05-28 #6 : persistance locale de la séance en cours.
 * Tout l'état séance vivait en React state → refresh / back / onglet tué =
 * 1h de muscu perdue. On snapshote un brouillon en localStorage à chaque
 * mutation, restauré au remontage, purgé après POST 201 ou abandon.
 */
const SESSION_DRAFT_PREFIX = "nodream:session-log:";
const SESSION_DRAFT_TTL_MS = 12 * 60 * 60 * 1000; // 12h : au-delà, brouillon périmé

function sessionDraftKey(uid: string, planId: string, blockIndex: number): string {
  return `${SESSION_DRAFT_PREFIX}${uid}:${planId}:${blockIndex}`;
}

export default function LogSessionPage() {
  const { user, loading, getFreshToken } = useAuth();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const planId = params.planId as string;
  const blockIndex = Math.max(0, parseInt(searchParams.get("block") ?? "0", 10) || 0);

  const [plan, setPlan] = useState<PlanDoc | null>(null);
  const [block, setBlock] = useState<PlanTrainingSession | null>(null);
  const [exercises, setExercises] = useState<LocalExercise[]>([]);
  const [userWeightKg, setUserWeightKg] = useState(75);
  const [activeExoIdx, setActiveExoIdx] = useState(0);
  const [activeSetIdx, setActiveSetIdx] = useState(0);
  const [userNotes, setUserNotes] = useState("");

  // Timer durée live
  const startedAtMs = useRef<number>(Date.now());
  const [nowMs, setNowMs] = useState(Date.now());

  const [fetching, setFetching] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const confirm = useConfirm();

  // Audit UX 2026-05-28 : timer de repos visible avec son + vibration
  const [restRemainingSec, setRestRemainingSec] = useState(0);
  const restEndAtRef = useRef<number>(0);

  // Audit UX 2026-05-28 #7 : historique dernière perf par exercice (pré-fetch)
  // Map exercise_id → { date, weight_kg, reps_done, rpe_felt } du dernier set fait
  const [lastPerfByExo, setLastPerfByExo] = useState<Record<string, {
    date: string;
    weight_kg: number;
    reps_done: number;
    rpe_felt: number;
  }>>({});

  // Beep via Web Audio API — pas de fichier audio, marche partout
  const playBeep = useCallback((freq = 800, durationMs = 250) => {
    try {
      const AudioCtx = (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + durationMs / 1000);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + durationMs / 1000);
    } catch {
      // Audio context bloqué (autoplay policy / contexte non-user-gesture) — silent fail
    }
  }, []);

  const startRestTimer = useCallback(
    (seconds: number) => {
      if (seconds <= 0) return;
      restEndAtRef.current = Date.now() + seconds * 1000;
      setRestRemainingSec(seconds);
    },
    [],
  );

  const skipRestTimer = useCallback(() => {
    restEndAtRef.current = 0;
    setRestRemainingSec(0);
  }, []);

  // Tick le countdown chaque seconde quand rest actif
  useEffect(() => {
    if (restRemainingSec <= 0) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.round((restEndAtRef.current - Date.now()) / 1000));
      setRestRemainingSec(remaining);
      // Beep + vibration à 5s restants et à la fin
      if (remaining === 5) {
        playBeep(600, 150);
      }
      if (remaining === 0) {
        playBeep(1000, 400);
        if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
          try {
            navigator.vibrate([200, 100, 200]);
          } catch {
            /* ignore */
          }
        }
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [restRemainingSec, playBeep]);

  // Tick chaque seconde pour la durée et les stats live
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Load plan + initialize exercises + user weight
  useEffect(() => {
    if (loading || !user || !planId) return;
    const load = async () => {
      try {
        const [planSnap, userSnap] = await Promise.all([
          getDoc(doc(db, "users", user.uid, "plans", planId)),
          getDoc(doc(db, "users", user.uid)),
        ]);
        if (!planSnap.exists()) {
          setErr("Plan introuvable");
          return;
        }
        const planData = { id: planSnap.id, ...planSnap.data() } as PlanDoc;
        setPlan(planData);

        const targetBlock = planData.training?.sessions?.[blockIndex];
        if (!targetBlock) {
          setErr(`Bloc d'entraînement ${blockIndex} introuvable dans le plan`);
          return;
        }
        setBlock(targetBlock);

        const initExos: LocalExercise[] = targetBlock.exercises.map((ex, idx) => {
          const defaultReps = parseTargetRepsLow(ex.reps);
          return {
            exercise_id: slugify(ex.name),
            exercise_name: ex.name,
            target_sets: ex.sets,
            target_reps_range: ex.reps,
            target_rest_seconds: ex.rest_seconds,
            block_code: buildBlockCode(idx, targetBlock.exercises),
            superset_group: ex.superset_group,
            sets: Array.from({ length: ex.sets }, () => ({
              weight_kg: 0,
              reps_done: defaultReps,
              rpe_felt: 8,
              completed: false,
            })),
          };
        });
        setExercises(initExos);

        // Audit #6 : restaure un brouillon de séance en cours s'il existe et
        // qu'il correspond structurellement au bloc (même nb d'exos + ids).
        try {
          const draftRaw = localStorage.getItem(sessionDraftKey(user.uid, planId, blockIndex));
          if (draftRaw) {
            const draft = JSON.parse(draftRaw) as {
              exercises?: LocalExercise[];
              userNotes?: string;
              startedAtMs?: number;
              activeExoIdx?: number;
              activeSetIdx?: number;
              savedAt?: number;
            };
            const fresh =
              typeof draft.savedAt === "number" && Date.now() - draft.savedAt < SESSION_DRAFT_TTL_MS;
            const matches =
              Array.isArray(draft.exercises) &&
              draft.exercises.length === initExos.length &&
              draft.exercises.every((d, i) => d.exercise_id === initExos[i].exercise_id);
            if (fresh && matches && draft.exercises) {
              setExercises(draft.exercises);
              if (typeof draft.userNotes === "string") setUserNotes(draft.userNotes);
              if (typeof draft.startedAtMs === "number" && draft.startedAtMs > 0) {
                startedAtMs.current = draft.startedAtMs;
              }
              if (typeof draft.activeExoIdx === "number") setActiveExoIdx(draft.activeExoIdx);
              if (typeof draft.activeSetIdx === "number") setActiveSetIdx(draft.activeSetIdx);
            } else if (!fresh) {
              localStorage.removeItem(sessionDraftKey(user.uid, planId, blockIndex));
            }
          }
        } catch (draftErr) {
          console.warn("[session/log] draft restore failed (non-blocking):", draftErr);
        }

        // User weight pour calcul calories MET-based
        const uw = (userSnap.data()?.profile?.weight as number) ?? userWeightKg;
        if (typeof uw === "number" && uw > 0) setUserWeightKg(uw);

        // Audit UX 2026-05-28 #7 : fetch last 20 workout_sessions pour build
        // un map exercise_id → dernière perf (best set par session).
        try {
          const sessSnap = await getDocs(
            query(
              collection(db, "users", user.uid, "workout_sessions"),
              orderBy("date", "desc"),
              limit(20),
            ),
          );
          const perfMap: Record<string, { date: string; weight_kg: number; reps_done: number; rpe_felt: number }> = {};
          for (const sessDoc of sessSnap.docs) {
            const sess = sessDoc.data() as { date?: string; exercises?: Array<{ exercise_id?: string; sets?: Array<{ weight_kg?: number; reps_done?: number; rpe_felt?: number }> }> };
            const sessDate = (sess.date ?? "").slice(0, 10);
            for (const ex of sess.exercises ?? []) {
              const eid = ex.exercise_id;
              if (!eid || perfMap[eid]) continue; // garde seulement la PLUS RÉCENTE
              type SetType = { weight_kg?: number; reps_done?: number; rpe_felt?: number };
              const bestSet: SetType | null = (ex.sets ?? [])
                .filter((s) => typeof s.weight_kg === "number" && typeof s.reps_done === "number")
                .reduce<SetType | null>(
                  (best, s) =>
                    (s.weight_kg ?? 0) * (s.reps_done ?? 0) > (best?.weight_kg ?? 0) * (best?.reps_done ?? 0)
                      ? s
                      : best,
                  null,
                );
              if (bestSet && typeof bestSet.weight_kg === "number" && typeof bestSet.reps_done === "number") {
                perfMap[eid] = {
                  date: sessDate,
                  weight_kg: bestSet.weight_kg,
                  reps_done: bestSet.reps_done,
                  rpe_felt: bestSet.rpe_felt ?? 0,
                };
              }
            }
          }
          setLastPerfByExo(perfMap);
        } catch (perfErr) {
          console.warn("[session/log] last perf fetch failed (non-blocking):", perfErr);
        }
      } catch (e: any) {
        console.error("[session/log] load failed:", e);
        setErr(e?.message ?? "Erreur de chargement");
      } finally {
        setFetching(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, planId, blockIndex]);

  // Audit #6 : snapshot le brouillon à chaque mutation (restauré au refresh).
  // Non bloquant : un échec localStorage (quota / navigation privée) est ignoré.
  useEffect(() => {
    if (fetching || success || !user || !planId || exercises.length === 0) return;
    try {
      localStorage.setItem(
        sessionDraftKey(user.uid, planId, blockIndex),
        JSON.stringify({
          exercises,
          userNotes,
          startedAtMs: startedAtMs.current,
          activeExoIdx,
          activeSetIdx,
          savedAt: Date.now(),
        }),
      );
    } catch {
      /* quota / private mode — non bloquant */
    }
  }, [exercises, userNotes, activeExoIdx, activeSetIdx, fetching, success, user, planId, blockIndex]);

  // ─── Derived stats (useMemo) ───────────────────────────────────

  const activeExo = exercises[activeExoIdx];
  const activeSet = activeExo?.sets[activeSetIdx];

  const durationSec = Math.max(0, Math.floor((nowMs - startedAtMs.current) / 1000));

  const completedSets = useMemo(
    () => exercises.flatMap((e) => e.sets.filter((s) => s.completed)),
    [exercises],
  );

  const volumeKg = useMemo(
    () => Math.round(completedSets.reduce((sum, s) => sum + s.weight_kg * s.reps_done, 0)),
    [completedSets],
  );

  const setsPlanned = useMemo(
    () => exercises.reduce((sum, e) => sum + e.target_sets, 0),
    [exercises],
  );
  const setsCompleted = completedSets.length;
  const completionPct =
    setsPlanned > 0 ? Math.min(100, Math.round((setsCompleted / setsPlanned) * 100)) : 0;
  const tonnageAvg = setsCompleted > 0 ? Math.round(volumeKg / setsCompleted) : 0;
  const durationMin = durationSec / 60;
  const densitySetsPerMin =
    durationMin > 0 ? Math.round((setsCompleted / durationMin) * 100) / 100 : 0;
  // Audit UX 2026-05-28 : ancienne formule basée sur durée → dérivait sans set
  // validé. Nouvelle formule : approx. 0.05 kcal par kg-rep de volume (sources :
  // estimation moyenne resistance training, Vezina 2014). Ne progresse que sur
  // travail effectif.
  const caloriesEst = Math.round(volumeKg * 0.05);

  const exosTouched = useMemo(
    () => exercises.filter((e) => e.sets.some((s) => s.completed)).length,
    [exercises],
  );

  // ─── Actions ────────────────────────────────────────────────────

  const updateActiveSet = useCallback(
    (field: keyof LocalSet, value: number) => {
      setExercises((prev) =>
        prev.map((ex, i) =>
          i === activeExoIdx
            ? {
                ...ex,
                sets: ex.sets.map((s, j) =>
                  j === activeSetIdx ? { ...s, [field]: value } : s,
                ),
              }
            : ex,
        ),
      );
    },
    [activeExoIdx, activeSetIdx],
  );

  const validateSet = useCallback(() => {
    if (!activeExo) return;
    const justCompleted = activeExo.sets[activeSetIdx];
    setExercises((prev) =>
      prev.map((ex, i) =>
        i === activeExoIdx
          ? {
              ...ex,
              sets: ex.sets.map((s, j) => {
                if (j === activeSetIdx) return { ...s, completed: true };
                // Audit UX 2026-05-28 : pré-remplir le set suivant avec les valeurs
                // du set qu'on vient de valider, seulement si pas encore touché
                // manuellement (weight_kg === 0 = init par défaut).
                if (
                  j === activeSetIdx + 1 &&
                  !s.completed &&
                  s.weight_kg === 0 &&
                  justCompleted
                ) {
                  return {
                    ...s,
                    weight_kg: justCompleted.weight_kg,
                    reps_done: justCompleted.reps_done,
                    rpe_felt: justCompleted.rpe_felt,
                  };
                }
                return s;
              }),
            }
          : ex,
      ),
    );
    // Navigate to next set ; if last set, next exo set 0 ; if last exo, stay
    if (activeSetIdx + 1 < activeExo.sets.length) {
      setActiveSetIdx(activeSetIdx + 1);
      // Démarre le timer de repos (Phase audit UX 2026-05-28)
      startRestTimer(activeExo.target_rest_seconds);
    } else if (activeExoIdx + 1 < exercises.length) {
      setActiveExoIdx(activeExoIdx + 1);
      setActiveSetIdx(0);
      // Repos inter-exo (souvent plus court mais on garde la même valeur)
      startRestTimer(activeExo.target_rest_seconds);
    }
  }, [activeExo, activeExoIdx, activeSetIdx, exercises.length]);

  const unvalidateSet = useCallback(() => {
    setExercises((prev) =>
      prev.map((ex, i) =>
        i === activeExoIdx
          ? {
              ...ex,
              sets: ex.sets.map((s, j) =>
                j === activeSetIdx ? { ...s, completed: false } : s,
              ),
            }
          : ex,
      ),
    );
  }, [activeExoIdx, activeSetIdx]);

  const addSetToActiveExo = useCallback(() => {
    if (!activeExo) return;
    const last = activeExo.sets[activeExo.sets.length - 1];
    setExercises((prev) =>
      prev.map((ex, i) =>
        i === activeExoIdx
          ? {
              ...ex,
              sets: [
                ...ex.sets,
                {
                  weight_kg: last?.weight_kg ?? 0,
                  reps_done: last?.reps_done ?? parseTargetRepsLow(ex.target_reps_range),
                  rpe_felt: last?.rpe_felt ?? 8,
                  completed: false,
                },
              ],
            }
          : ex,
      ),
    );
  }, [activeExo, activeExoIdx]);

  const selectExoAndSet = useCallback((exoIdx: number, setIdx: number) => {
    setActiveExoIdx(exoIdx);
    setActiveSetIdx(setIdx);
  }, []);

  const handleTerminer = async () => {
    if (!user || !plan || submitting) return;
    if (setsCompleted === 0) {
      setErr("Valide au moins un set avant de terminer la séance.");
      return;
    }
    setErr(null);
    setSubmitting(true);
    try {
      const token = await getFreshToken();
      if (!token) throw new Error("Authentification requise");

      // Payload : on n'inclut que les sets completed=true
      const payloadExercises = exercises
        .map((ex) => ({
          exercise_id: ex.exercise_id,
          exercise_name: ex.exercise_name,
          sets_logged: ex.sets
            .filter((s) => s.completed)
            .map((s, idx) => ({
              set_index: idx + 1,
              weight_kg: s.weight_kg,
              reps_done: s.reps_done,
              rpe_felt: s.rpe_felt,
            })),
        }))
        .filter((ex) => ex.sets_logged.length > 0);

      const res = await fetch("/api/sessions/log-full", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          plan_id: planId,
          session_block_index: blockIndex,
          operation_name: block?.name,
          duration_minutes: Math.max(1, Math.round(durationSec / 60)),
          started_at: new Date(startedAtMs.current).toISOString(),
          exercises: payloadExercises,
          ...(userNotes.trim() ? { user_notes: userNotes.trim() } : {}),
        }),
      });

      const text = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(
          res.status === 504 || res.status === 408
            ? "Le serveur a mis trop de temps. Réessaye dans un moment."
            : `Erreur ${res.status}. Réessaye, ou contacte le support.`,
        );
      }
      if (!res.ok) throw new Error(data?.error ?? "Enregistrement échoué");

      setSuccess(true);
      // Audit #6 : séance persistée côté serveur → purge le brouillon local.
      try {
        if (user) localStorage.removeItem(sessionDraftKey(user.uid, planId, blockIndex));
      } catch { /* non bloquant */ }
      // Redirige vers /workout/summary qui auto-fire le debrief Vertex via
      // /api/ai/coach-session-debrief. La séance elle-même n'a pas besoin
      // de Vertex (juste Firestore) — l'analyse coach se fait là.
      const sessionId = data?.session_id;
      setTimeout(() => {
        if (sessionId) {
          router.push(`/workout/summary?from=${sessionId}`);
        } else {
          router.push("/dashboard");
        }
      }, 1500);
    } catch (e: any) {
      setErr(e?.message ?? "Impossible d'enregistrer la séance");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────

  if (loading || fetching) {
    return <Loader size="fullscreen" message="Chargement de la séance..." />;
  }

  if (err && !block) {
    return (
      <div className="flex-1 flex items-center justify-center px-6 py-10">
        <HudCard accent="tech" chamfer="sm" style={{ padding: "1.5rem", maxWidth: 480 }}>
          <PanelHeader code="ERR-LOG" title="Bloc indisponible" accent="tech" />
          <p style={{ fontSize: 12, color: "var(--fg-3)", margin: "0 0 16px 0" }}>{err}</p>
          <button
            onClick={() => router.push("/session")}
            className="btn btn-primary"
            style={{ width: "100%" }}
          >
            Retour au sélecteur
          </button>
        </HudCard>
      </div>
    );
  }

  if (!block || !activeExo) return null;

  // Audit UX 2026-05-28 : `V??` était un placeholder jamais bindé. Le vrai
  // session_code est généré server-side par /api/sessions/log-full au final POST
  // (compteur des sessions de même opération). On affiche "LIVE" pour signaler
  // que la séance est en cours et que le numéro sera attribué à la fin.
  const sessionCodeDisplay = (() => {
    const op = (block.name ?? "SESS")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toUpperCase()
      .trim()
      .split(/[^A-Z]+/)
      .filter((w) => w.length > 2)[0];
    return `${(op ?? "SESS").slice(0, 5)}-LIVE`;
  })();

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10 space-y-4">
      {/* ============ HEADER BAR ============ */}
      <HudCard accent="tech" chamfer="sm" style={{ padding: "0.75rem 1rem" }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span
              className="mono"
              style={{
                fontSize: 9,
                letterSpacing: "0.3em",
                color: "var(--accent-tech)",
                textTransform: "uppercase",
                fontWeight: 700,
              }}
            >
              ● SESSION-LIVE · {sessionCodeDisplay}
            </span>
            <h1
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "1.1rem",
                fontWeight: 900,
                color: "var(--fg-1)",
                letterSpacing: "0.04em",
                margin: "2px 0 0 0",
                textTransform: "uppercase",
              }}
            >
              OPÉRATION :{" "}
              <span style={{ color: "var(--gold-400)" }}>{block.name}</span>
            </h1>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <HeaderStat label="Durée" value={formatDuration(durationSec)} />
            <HeaderStat label="Volume" value={`${volumeKg}kg`} />
            <HeaderStat
              label="Exos"
              value={`${exosTouched}/${exercises.length}`}
            />
            <HeaderStat label="Prog" value={`${completionPct}%`} accent="gold" />
            <button
              type="button"
              onClick={async () => {
                // Audit #6 : confirmation avant abandon (évite la perte
                // accidentelle de la séance) + purge du brouillon local.
                if (!(await confirm({
                  title: "Abandonner la séance",
                  message: "Les sets non enregistrés seront perdus.",
                  confirmLabel: "Abandonner",
                  danger: true,
                }))) return;
                try {
                  if (user) localStorage.removeItem(sessionDraftKey(user.uid, planId, blockIndex));
                } catch { /* non bloquant */ }
                router.push("/session");
              }}
              className="mono cursor-pointer"
              style={{
                padding: "6px 12px",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                background: "var(--alert-tint-15)",
                color: "var(--alert-500)",
                border: "1px solid var(--alert-500)",
                clipPath:
                  "polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
              aria-label="Abandonner la séance"
            >
              <Square className="h-3 w-3" aria-hidden="true" /> Abandonner
            </button>
          </div>
        </div>
      </HudCard>

      {/* Audit UX 2026-05-28 : timer de repos visible, beep à 5s et fin, vibration à 0 */}
      {restRemainingSec > 0 && (
        <div
          role="timer"
          aria-live="polite"
          aria-label={`Repos ${restRemainingSec} secondes restantes`}
          className="mono flex items-center justify-between gap-3"
          style={{
            padding: "12px 16px",
            background: restRemainingSec <= 5 ? "var(--accent-tech-tint)" : "var(--glass-bg-2)",
            border: `2px solid ${restRemainingSec <= 5 ? "var(--accent-tech)" : "var(--gold-400)"}`,
            color: restRemainingSec <= 5 ? "var(--accent-tech)" : "var(--gold-400)",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            clipPath:
              "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)",
          }}
        >
          <div className="flex items-center gap-3">
            <TimerReset className="h-5 w-5" aria-hidden="true" />
            <span>REPOS · {String(Math.floor(restRemainingSec / 60)).padStart(2, "0")}:{String(restRemainingSec % 60).padStart(2, "0")}</span>
          </div>
          <button
            type="button"
            onClick={skipRestTimer}
            className="mono"
            style={{
              padding: "4px 10px",
              background: "transparent",
              border: "1px solid currentColor",
              color: "inherit",
              fontSize: 10,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
            aria-label="Sauter le repos"
          >
            Skip
          </button>
        </div>
      )}

      {success && (
        <div
          role="status"
          aria-live="polite"
          className="mono flex items-center gap-2"
          style={{
            padding: "10px 14px",
            background: "var(--accent-tech-tint)",
            border: "1px solid var(--accent-tech)",
            color: "var(--accent-tech)",
            fontSize: 11,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            clipPath:
              "polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)",
          }}
        >
          <Check className="h-4 w-4" aria-hidden="true" />
          [ACK] Séance enregistrée — redirection vers le dashboard...
        </div>
      )}

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
            [ERR-LOG]
          </span>
          {err}
        </div>
      )}

      {/* ============ EXERCICE EN COURS + STATS ============ */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Active exercise card (2/3) */}
        <HudCard accent="gold" chamfer="sm" style={{ padding: "1rem 1.25rem" }} className="lg:col-span-2">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <span
                className="mono"
                style={{
                  fontSize: 10,
                  letterSpacing: "0.3em",
                  color: "var(--accent-tech)",
                  textTransform: "uppercase",
                }}
              >
                ● Exercice en cours · [{activeExo.block_code}]
              </span>
              <h2
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "1.3rem",
                  fontWeight: 900,
                  color: "var(--fg-1)",
                  margin: "4px 0 0 0",
                  lineHeight: 1.2,
                }}
              >
                {activeExo.exercise_name}
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Tag accent="gold">
              SÉRIE {activeSetIdx + 1} / {activeExo.sets.length}
            </Tag>
            <Tag accent="tech">CIBLE : {activeExo.target_reps_range} REPS</Tag>
            <Tag accent="gold">REPOS {activeExo.target_rest_seconds}s</Tag>
          </div>

          {/* Audit UX 2026-05-28 #7 : historique dernière perf sur cet exo */}
          {lastPerfByExo[activeExo.exercise_id] && (
            <div
              className="mono mb-3"
              style={{
                padding: "8px 12px",
                background: "var(--glass-bg-2)",
                border: "1px dashed var(--glass-border)",
                fontSize: 11,
                color: "var(--fg-3)",
                letterSpacing: "0.05em",
                clipPath:
                  "polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)",
              }}
            >
              <span style={{ color: "var(--fg-4)" }}>DERNIÈRE FOIS · {lastPerfByExo[activeExo.exercise_id].date}</span>{" "}
              <span style={{ color: "var(--gold-400)", fontWeight: 700 }}>
                {lastPerfByExo[activeExo.exercise_id].weight_kg} kg
              </span>{" "}
              ×{" "}
              <span style={{ color: "var(--fg-1)", fontWeight: 700 }}>
                {lastPerfByExo[activeExo.exercise_id].reps_done} reps
              </span>
              {lastPerfByExo[activeExo.exercise_id].rpe_felt > 0 && (
                <>
                  {" "}@ RPE{" "}
                  <span style={{ color: "var(--accent-tech)", fontWeight: 700 }}>
                    {lastPerfByExo[activeExo.exercise_id].rpe_felt}
                  </span>
                </>
              )}
            </div>
          )}

          {/* Boutons SET 1/2/3/... */}
          <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))" }}>
            {activeExo.sets.map((set, sIdx) => {
              const isActive = sIdx === activeSetIdx;
              const isCompleted = set.completed;
              return (
                <button
                  key={sIdx}
                  type="button"
                  onClick={() => setActiveSetIdx(sIdx)}
                  className="mono cursor-pointer"
                  style={{
                    padding: "10px 8px",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.2em",
                    textTransform: "uppercase",
                    background: isCompleted
                      ? "var(--accent-tech-tint)"
                      : isActive
                        ? "var(--gold-tint-15)"
                        : "var(--glass-bg-2)",
                    color: isCompleted
                      ? "var(--accent-tech)"
                      : isActive
                        ? "var(--gold-400)"
                        : "var(--fg-4)",
                    border: `1px solid ${
                      isCompleted
                        ? "var(--accent-tech)"
                        : isActive
                          ? "var(--gold-tint-35)"
                          : "var(--glass-border)"
                    }`,
                    boxShadow: isActive ? "var(--glow-gold-soft)" : "none",
                    clipPath:
                      "polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                  }}
                >
                  SET {sIdx + 1}
                  {isCompleted && <Check className="h-3 w-3" aria-hidden="true" />}
                  {!isCompleted && isActive && <ChevronRight className="h-3 w-3" aria-hidden="true" />}
                </button>
              );
            })}
            <button
              type="button"
              onClick={addSetToActiveExo}
              aria-label="Ajouter un set"
              className="mono cursor-pointer"
              style={{
                padding: "10px 8px",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                background: "transparent",
                color: "var(--fg-5)",
                border: "1px dashed var(--glass-border)",
                clipPath:
                  "polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
              }}
            >
              <Plus className="h-3 w-3" aria-hidden="true" />
            </button>
          </div>

          {/* Steppers CHARGE / RÉPÉTITIONS / RPE */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            <Stepper
              label="Charge"
              unit="kg"
              value={activeSet?.weight_kg ?? 0}
              step={2.5}
              min={0}
              max={600}
              decimals={1}
              onChange={(v) => updateActiveSet("weight_kg", v)}
            />
            <Stepper
              label="Répétitions"
              unit="reps"
              value={activeSet?.reps_done ?? 0}
              step={1}
              min={0}
              max={200}
              decimals={0}
              onChange={(v) => updateActiveSet("reps_done", v)}
            />
            <Stepper
              label="RPE ressenti"
              unit="/10"
              value={activeSet?.rpe_felt ?? 8}
              step={0.5}
              min={1}
              max={10}
              decimals={1}
              onChange={(v) => updateActiveSet("rpe_felt", v)}
            />
          </div>

          {/* Bouton VALIDER */}
          <button
            type="button"
            onClick={activeSet?.completed ? unvalidateSet : validateSet}
            disabled={!activeSet || (!activeSet.completed && activeSet.reps_done <= 0 && activeSet.weight_kg <= 0)}
            className="mono cursor-pointer"
            style={{
              width: "100%",
              height: 48,
              marginTop: 12,
              background: activeSet?.completed
                ? "var(--glass-bg-2)"
                : "var(--accent-tech-tint)",
              color: activeSet?.completed ? "var(--fg-3)" : "var(--accent-tech)",
              border: `1px solid ${activeSet?.completed ? "var(--glass-border)" : "var(--accent-tech)"}`,
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              clipPath:
                "polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              boxShadow: activeSet?.completed ? "none" : "0 0 12px var(--accent-tech-tint-strong)",
            }}
          >
            {activeSet?.completed ? (
              <>
                <TimerReset className="h-4 w-4" aria-hidden="true" /> Dévalider ce set
              </>
            ) : (
              <>
                <Check className="h-4 w-4" aria-hidden="true" /> Valider la série → repos {activeExo.target_rest_seconds}s
              </>
            )}
          </button>
        </HudCard>

        {/* Stats card (1/3) */}
        <HudCard accent="tech" chamfer="sm" style={{ padding: "1rem 1.25rem" }}>
          <PanelHeader
            code="STAT"
            title={
              <span className="flex items-center gap-2">
                <Activity className="h-4 w-4" style={{ color: "var(--accent-tech)" }} aria-hidden="true" />
                Stats session
              </span>
            }
            accent="tech"
            right={<Tag accent="tech">LIVE</Tag>}
          />
          <div className="space-y-2 mt-1">
            <StatRow label="Volume total" value={`${volumeKg} kg`} />
            <StatRow label="Tonnage moyen / set" value={`${tonnageAvg} kg`} />
            <StatRow label="Densité (set/min)" value={`${densitySetsPerMin}`} />
            <StatRow
              label="Calories estimées"
              value={`${caloriesEst} kcal`}
              icon={<Flame className="h-3 w-3" style={{ color: "var(--gold-400)" }} aria-hidden="true" />}
            />
            <StatRow label="Sets complétés" value={`${setsCompleted} / ${setsPlanned}`} />
          </div>
          <button
            type="button"
            onClick={handleTerminer}
            disabled={submitting || success || setsCompleted === 0}
            className="mono cursor-pointer"
            style={{
              width: "100%",
              marginTop: 16,
              height: 44,
              background: "var(--gold-tint-15)",
              color: "var(--gold-400)",
              border: "1px solid var(--gold-tint-35)",
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              boxShadow: "var(--glow-gold-soft)",
              clipPath:
                "polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              opacity: submitting || success || setsCompleted === 0 ? 0.5 : 1,
            }}
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            {submitting
              ? "Enregistrement..."
              : success
                ? "Enregistré"
                : completionPct >= 100
                  ? "Terminer la séance"
                  : "Terminer (incomplet)"}
          </button>
        </HudCard>
      </div>

      {/* ============ FILE D'EXÉCUTION ============ */}
      <HudCard accent="gold" chamfer="sm" style={{ padding: "1rem 1.25rem" }}>
        <PanelHeader
          code="QUEUE"
          title="File d'exécution"
          accent="gold"
          right={<Tag accent="gold">{exercises.length} EXOS</Tag>}
        />
        <div className="space-y-1 mt-2">
          {exercises.map((ex, exoIdx) => {
            const isActive = exoIdx === activeExoIdx;
            const completedHere = ex.sets.filter((s) => s.completed).length;
            const allDone = completedHere === ex.sets.length;
            const someDone = completedHere > 0;
            return (
              <button
                key={ex.exercise_id + "_" + exoIdx}
                type="button"
                onClick={() => selectExoAndSet(exoIdx, 0)}
                className="mono cursor-pointer"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  background: isActive ? "var(--gold-tint-08)" : "transparent",
                  border: `1px solid ${isActive ? "var(--gold-tint-25)" : "transparent"}`,
                  borderLeft: isActive
                    ? "3px solid var(--gold-400)"
                    : allDone
                      ? "3px solid var(--accent-tech)"
                      : "3px solid transparent",
                  display: "grid",
                  gridTemplateColumns: "20px 40px 1fr auto",
                  alignItems: "center",
                  gap: 12,
                  textAlign: "left",
                  fontSize: 12,
                  color: allDone
                    ? "var(--fg-5)"
                    : isActive
                      ? "var(--fg-1)"
                      : someDone
                        ? "var(--fg-2)"
                        : "var(--fg-3)",
                  textDecoration: allDone ? "line-through" : "none",
                  fontWeight: isActive ? 700 : 400,
                }}
              >
                <span>
                  {allDone ? (
                    <Check className="h-3 w-3" style={{ color: "var(--accent-tech)" }} aria-hidden="true" />
                  ) : isActive ? (
                    <ChevronRight className="h-3 w-3" style={{ color: "var(--gold-400)" }} aria-hidden="true" />
                  ) : (
                    <span style={{ color: "var(--fg-5)" }}>·</span>
                  )}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.15em",
                    color: isActive ? "var(--gold-400)" : "var(--fg-5)",
                    fontWeight: 700,
                  }}
                >
                  {ex.block_code}
                </span>
                <span>{ex.exercise_name}</span>
                <span
                  className="mono"
                  style={{
                    fontSize: 10,
                    color: "var(--fg-5)",
                    letterSpacing: "0.1em",
                  }}
                >
                  {completedHere}/{ex.sets.length}×{ex.target_reps_range}
                </span>
              </button>
            );
          })}
        </div>
      </HudCard>

      {/* ============ NOTES ============ */}
      <HudCard accent="tech" chamfer="sm" style={{ padding: "1rem 1.25rem" }}>
        <PanelHeader code="NOTES" title="Notes de séance (optionnel)" accent="tech" />
        <textarea
          value={userNotes}
          onChange={(e) => setUserNotes(e.target.value)}
          placeholder="Ressenti, conditions, douleur, etc."
          rows={3}
          className="mono"
          style={{
            width: "100%",
            background: "var(--glass-bg-2)",
            border: "1px solid var(--glass-border)",
            color: "var(--fg-1)",
            fontSize: 12,
            padding: "8px 10px",
            resize: "vertical",
            minHeight: 70,
            clipPath:
              "polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)",
          }}
        />
      </HudCard>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Helpers UI
// ────────────────────────────────────────────────────────────────

function HeaderStat({ label, value, accent }: { label: string; value: string; accent?: "gold" }) {
  return (
    <div className="flex flex-col items-center">
      <span
        className="mono"
        style={{
          fontSize: 8,
          letterSpacing: "0.25em",
          color: "var(--fg-5)",
          textTransform: "uppercase",
          fontWeight: 700,
        }}
      >
        {label}
      </span>
      <span
        className="mono"
        style={{
          fontSize: 14,
          fontWeight: 800,
          color: accent === "gold" ? "var(--gold-400)" : "var(--fg-1)",
          letterSpacing: "0.05em",
          marginTop: 2,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function StatRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span
        className="mono"
        style={{
          fontSize: 10,
          color: "var(--fg-4)",
          letterSpacing: "0.1em",
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        {icon}
        {label}
      </span>
      <span
        className="mono"
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: "var(--fg-1)",
        }}
      >
        {value}
      </span>
    </div>
  );
}
