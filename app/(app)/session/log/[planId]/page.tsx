/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/firebase/hooks";
import { Loader } from "@/components/ui/loader";
import { HudCard, PanelHeader, Tag } from "@/components/nodream";
import { Plus, Minus, Save, ArrowLeft, CheckCircle2 } from "lucide-react";
import type { PlanDoc, PlanTrainingSession } from "@/types/plan";

/**
 * Page /session/log/[planId]?block=N — log post-séance simple.
 *
 * Pattern industrie (Strong/Hevy/Jefit) : l'utilisateur saisit toute sa
 * séance en une fois APRÈS l'avoir faite. Pas de live tracking, pas de
 * Firestore write par set, pas de transaction concurrente.
 *
 * Tout est local jusqu'au bouton "Enregistrer", qui POST tout en un seul
 * appel à /api/sessions/log-full → 1 batch Firestore.
 */

interface SetInput {
  weight_kg: string; // string pour permettre champ vide
  reps_done: string;
  rpe_felt: string;
  loaded_kg?: string;
  notes?: string;
}

interface ExerciseEntry {
  exercise_id: string;
  exercise_name: string;
  target_sets: number;
  target_reps_range: string;
  target_rest_seconds: number;
  sets: SetInput[];
}

function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const inputStyle: React.CSSProperties = {
  background: "var(--glass-bg-2)",
  border: "1px solid var(--glass-border)",
  color: "var(--fg-1)",
  fontSize: 14,
  padding: "0 10px",
  height: 38,
  width: "100%",
  textAlign: "center",
  clipPath:
    "polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)",
};

const labelStyle: React.CSSProperties = {
  fontSize: 9,
  letterSpacing: "0.18em",
  color: "var(--fg-4)",
  textTransform: "uppercase",
  fontWeight: 700,
  display: "block",
  marginBottom: 4,
};

export default function LogSessionPage() {
  const { user, loading, getFreshToken } = useAuth();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const planId = params.planId as string;
  const blockIndex = Math.max(0, parseInt(searchParams.get("block") ?? "0", 10) || 0);

  const [plan, setPlan] = useState<PlanDoc | null>(null);
  const [block, setBlock] = useState<PlanTrainingSession | null>(null);
  const [exercises, setExercises] = useState<ExerciseEntry[]>([]);
  const [durationMinutes, setDurationMinutes] = useState<string>("60");
  const [userNotes, setUserNotes] = useState<string>("");

  const [fetching, setFetching] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Load plan + initialize exercises
  useEffect(() => {
    if (loading || !user || !planId) return;
    const load = async () => {
      try {
        const planRef = doc(db, "users", user.uid, "plans", planId);
        const snap = await getDoc(planRef);
        if (!snap.exists()) {
          setErr("Plan introuvable");
          return;
        }
        const planData = { id: snap.id, ...snap.data() } as PlanDoc;
        setPlan(planData);

        const targetBlock = planData.training?.sessions?.[blockIndex];
        if (!targetBlock) {
          setErr(`Bloc d'entraînement ${blockIndex} introuvable dans le plan`);
          return;
        }
        setBlock(targetBlock);

        // Initialize exercises : 1 set vide par défaut par exo (target_sets sets vides en fait)
        const initExos: ExerciseEntry[] = targetBlock.exercises.map((ex) => ({
          exercise_id: slugify(ex.name),
          exercise_name: ex.name,
          target_sets: ex.sets,
          target_reps_range: ex.reps,
          target_rest_seconds: ex.rest_seconds,
          sets: Array.from({ length: ex.sets }, () => ({
            weight_kg: "",
            reps_done: "",
            rpe_felt: "8",
          })),
        }));
        setExercises(initExos);
      } catch (e: any) {
        console.error("[session/log] load failed:", e);
        setErr(e?.message ?? "Erreur de chargement");
      } finally {
        setFetching(false);
      }
    };
    load();
  }, [user, loading, planId, blockIndex]);

  const updateSetField = useCallback(
    (exoIdx: number, setIdx: number, field: keyof SetInput, value: string) => {
      setExercises((prev) => {
        const copy = prev.map((ex, i) =>
          i === exoIdx
            ? {
                ...ex,
                sets: ex.sets.map((s, j) => (j === setIdx ? { ...s, [field]: value } : s)),
              }
            : ex,
        );
        return copy;
      });
    },
    [],
  );

  const addSet = useCallback((exoIdx: number) => {
    setExercises((prev) =>
      prev.map((ex, i) =>
        i === exoIdx
          ? {
              ...ex,
              sets: [
                ...ex.sets,
                {
                  weight_kg: ex.sets[ex.sets.length - 1]?.weight_kg ?? "",
                  reps_done: "",
                  rpe_felt: ex.sets[ex.sets.length - 1]?.rpe_felt ?? "8",
                },
              ],
            }
          : ex,
      ),
    );
  }, []);

  const removeSet = useCallback((exoIdx: number, setIdx: number) => {
    setExercises((prev) =>
      prev.map((ex, i) =>
        i === exoIdx ? { ...ex, sets: ex.sets.filter((_, j) => j !== setIdx) } : ex,
      ),
    );
  }, []);

  const totalSetsLogged = useMemo(
    () =>
      exercises.reduce(
        (sum, ex) =>
          sum +
          ex.sets.filter(
            (s) =>
              s.weight_kg.trim() !== "" || parseFloat(s.reps_done) > 0,
          ).length,
        0,
      ),
    [exercises],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !plan || submitting) return;

    // Validation : au moins 1 set rempli au total
    if (totalSetsLogged === 0) {
      setErr("Saisis au moins un set avec poids/reps avant d'enregistrer.");
      return;
    }

    setErr(null);
    setSubmitting(true);
    try {
      const token = await getFreshToken();
      if (!token) throw new Error("Authentification requise");

      // Build le body : on ne garde que les sets remplis (weight ou reps > 0)
      const payloadExercises = exercises
        .map((ex) => ({
          exercise_id: ex.exercise_id,
          exercise_name: ex.exercise_name,
          sets_logged: ex.sets
            .filter((s) => s.weight_kg.trim() !== "" || parseFloat(s.reps_done) > 0)
            .map((s, idx) => {
              const set: any = {
                set_index: idx + 1,
                weight_kg: parseFloat(s.weight_kg) || 0,
                reps_done: parseInt(s.reps_done, 10) || 0,
                rpe_felt: parseInt(s.rpe_felt, 10) || 8,
              };
              if (s.loaded_kg && s.loaded_kg.trim() !== "") {
                const ld = parseFloat(s.loaded_kg);
                if (!isNaN(ld)) set.loaded_kg = ld;
              }
              if (s.notes && s.notes.trim() !== "") {
                set.notes = s.notes.trim();
              }
              return set;
            }),
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
          duration_minutes: Math.max(1, parseInt(durationMinutes, 10) || 60),
          exercises: payloadExercises,
          ...(userNotes.trim() ? { user_notes: userNotes.trim() } : {}),
        }),
      });

      // Defensive non-JSON parsing : si Vercel timeout ou autre erreur HTML
      const text = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(
          res.status === 504
            ? "Le serveur a mis trop de temps. Réessaye dans un moment."
            : `Erreur ${res.status}. Réessaye, ou contacte le support.`,
        );
      }
      if (!res.ok) throw new Error(data?.error ?? "Enregistrement échoué");

      setSuccess(true);
      // Petite pause pour que l'utilisateur voie la confirmation
      setTimeout(() => {
        router.push("/dashboard");
      }, 1500);
    } catch (e: any) {
      setErr(e?.message ?? "Impossible d'enregistrer la séance");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || fetching) {
    return <Loader size="fullscreen" message="Chargement du bloc..." />;
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

  if (!block) return null;

  return (
    <div className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10 space-y-6">
      {/* Tactical header */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => router.push("/session")}
          className="mono flex items-center gap-2 cursor-pointer"
          style={{
            fontSize: 10,
            letterSpacing: "0.2em",
            color: "var(--fg-5)",
            textTransform: "uppercase",
            background: "transparent",
            border: "none",
            padding: 0,
            marginBottom: 4,
          }}
        >
          <ArrowLeft className="h-3 w-3" aria-hidden="true" /> Sélecteur
        </button>
        <span
          className="mono"
          style={{
            fontSize: 10,
            letterSpacing: "0.3em",
            color: "var(--accent-tech)",
            opacity: 0.85,
          }}
        >
          [SESSION · LOG · POST-OPS]
        </span>
        <h2
          style={{
            fontFamily: "var(--font-sans)",
            fontWeight: 900,
            fontSize: "var(--type-h1)",
            letterSpacing: "var(--tracking-display)",
            lineHeight: 1.05,
            color: "var(--fg-1)",
            marginTop: 4,
          }}
        >
          {block.name}
        </h2>
        <p
          className="mono"
          style={{
            fontSize: "var(--type-meta)",
            letterSpacing: "0.18em",
            color: "var(--fg-4)",
            textTransform: "uppercase",
            margin: 0,
          }}
        >
          Saisis tes charges et reps · ORACLE.IA analysera après
        </p>
      </div>

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
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          [ACK] Séance enregistrée. Redirection vers le dashboard...
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

      <form onSubmit={handleSubmit} className="space-y-4">
        {exercises.map((ex, exoIdx) => (
          <HudCard key={ex.exercise_id + "_" + exoIdx} accent="gold" chamfer="sm" style={{ padding: "1rem 1.25rem" }}>
            <PanelHeader
              code={`E${(exoIdx + 1).toString().padStart(2, "0")}`}
              title={ex.exercise_name}
              accent="gold"
              right={
                <Tag accent="gold">
                  {ex.target_sets}×{ex.target_reps_range}
                </Tag>
              }
            />
            <p
              className="mono"
              style={{
                fontSize: 9,
                letterSpacing: "0.15em",
                color: "var(--fg-5)",
                textTransform: "uppercase",
                marginTop: -4,
                marginBottom: 12,
              }}
            >
              Cible : {ex.target_sets} sets · {ex.target_reps_range} reps · repos {ex.target_rest_seconds}s
            </p>

            <div className="space-y-2">
              {/* Header */}
              <div
                className="grid gap-2 mono"
                style={{ gridTemplateColumns: "30px 1fr 1fr 1fr 32px", fontSize: 9, color: "var(--fg-5)", letterSpacing: "0.15em", textTransform: "uppercase" }}
              >
                <span style={{ textAlign: "center" }}>#</span>
                <span style={{ textAlign: "center" }}>Poids (kg)</span>
                <span style={{ textAlign: "center" }}>Reps</span>
                <span style={{ textAlign: "center" }}>RPE 1-10</span>
                <span></span>
              </div>

              {ex.sets.map((set, setIdx) => (
                <div
                  key={setIdx}
                  className="grid gap-2 items-center"
                  style={{ gridTemplateColumns: "30px 1fr 1fr 1fr 32px" }}
                >
                  <span
                    className="mono"
                    style={{
                      textAlign: "center",
                      fontSize: 13,
                      fontWeight: 700,
                      color: "var(--gold-400)",
                    }}
                  >
                    {setIdx + 1}
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.5"
                    min="0"
                    max="600"
                    value={set.weight_kg}
                    onChange={(e) => updateSetField(exoIdx, setIdx, "weight_kg", e.target.value)}
                    className="mono"
                    style={inputStyle}
                    aria-label={`Set ${setIdx + 1} poids en kg`}
                  />
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    max="200"
                    value={set.reps_done}
                    onChange={(e) => updateSetField(exoIdx, setIdx, "reps_done", e.target.value)}
                    className="mono"
                    style={inputStyle}
                    aria-label={`Set ${setIdx + 1} reps`}
                  />
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="10"
                    value={set.rpe_felt}
                    onChange={(e) => updateSetField(exoIdx, setIdx, "rpe_felt", e.target.value)}
                    className="mono"
                    style={inputStyle}
                    aria-label={`Set ${setIdx + 1} RPE`}
                  />
                  <button
                    type="button"
                    onClick={() => removeSet(exoIdx, setIdx)}
                    disabled={ex.sets.length <= 1}
                    className="mono cursor-pointer"
                    style={{
                      height: 38,
                      width: 32,
                      background: "var(--glass-bg-2)",
                      border: "1px solid var(--glass-border)",
                      color: ex.sets.length <= 1 ? "var(--fg-5)" : "var(--alert-500)",
                      opacity: ex.sets.length <= 1 ? 0.4 : 1,
                      clipPath:
                        "polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    aria-label={`Supprimer set ${setIdx + 1}`}
                  >
                    <Minus className="h-3 w-3" aria-hidden="true" />
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={() => addSet(exoIdx)}
                className="mono cursor-pointer"
                style={{
                  width: "100%",
                  height: 32,
                  background: "var(--gold-tint-08)",
                  border: "1px dashed var(--gold-tint-25)",
                  color: "var(--gold-400)",
                  fontSize: 10,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  fontWeight: 700,
                  clipPath:
                    "polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  marginTop: 4,
                }}
              >
                <Plus className="h-3 w-3" aria-hidden="true" />
                Ajouter un set
              </button>
            </div>
          </HudCard>
        ))}

        {/* Métadonnées de séance */}
        <HudCard accent="tech" chamfer="sm" style={{ padding: "1rem 1.25rem" }}>
          <PanelHeader code="META" title="Données de séance" accent="tech" />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="log-duration" style={labelStyle}>
                Durée (min)
              </label>
              <input
                id="log-duration"
                type="number"
                inputMode="numeric"
                min="1"
                max="360"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                className="mono"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Sets remplis</label>
              <div
                className="mono"
                style={{
                  height: 38,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "var(--glass-bg-2)",
                  border: "1px solid var(--glass-border)",
                  color: "var(--accent-tech)",
                  fontSize: 14,
                  fontWeight: 700,
                  clipPath:
                    "polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)",
                }}
              >
                {totalSetsLogged}
              </div>
            </div>
          </div>

          <div className="mt-4">
            <label htmlFor="log-notes" style={labelStyle}>
              Notes (optionnel)
            </label>
            <textarea
              id="log-notes"
              rows={3}
              value={userNotes}
              onChange={(e) => setUserNotes(e.target.value)}
              className="mono"
              placeholder="Ressenti, douleur, conditions, etc."
              style={{
                ...inputStyle,
                height: "auto",
                padding: "8px 10px",
                textAlign: "left",
                resize: "vertical",
                minHeight: 70,
              }}
            />
          </div>
        </HudCard>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.push("/session")}
            className="btn btn-ghost"
            style={{ flex: "0 0 auto", padding: "0 24px" }}
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={submitting || success || totalSetsLogged === 0}
            className="btn btn-primary"
            style={{ flex: 1 }}
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            {submitting ? "Enregistrement..." : "Enregistrer la séance"}
          </button>
        </div>
      </form>
    </div>
  );
}
