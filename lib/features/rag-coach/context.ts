/**
 * Bridge between user profile data and RAG retrieval filters.
 *
 * Centralizes the "given a userData, what level + equipment do I filter on"
 * logic so /api/ai/coach and /api/ai/generate-plan stay in sync.
 */

import type { TrainingEnvironment } from "@/types/user";
import type { NormalizedProfile } from "@/lib/features/user-profile/snapshot";
import {
  retrieveExercises,
  retrieveMethods,
  formatExercisesForPrompt,
  formatMethodsForPrompt,
} from "./retrieve";
import type { ExerciseRetrievalFilter } from "./retrieve";

/**
 * Equipment slugs allowed per training environment.
 * Empty array = unrestricted (caller should pass undefined to skip the filter).
 */
const ENV_EQUIPMENT: Record<TrainingEnvironment, string[]> = {
  gym: [], // full gym = no filter
  home_gym: [
    "aucun",
    "barre",
    "barre_ez",
    "halteres",
    "haltere",
    "banc_plat",
    "banc_incline",
    "banc_decline",
    "banc_dossier",
    "banc_predicateur",
    "banc_hyperext",
    "rack",
    "barre_traction",
    "barre_traction_neutre",
    "barres_paralleles",
    "kettlebells",
    "kettlebell",
    "anneaux",
    "elastique",
    "disques",
    "disque",
    "trap_bar",
    "ceinture_lest",
    "roue_abdo",
    "corde_a_sauter",
    "box",
    "box_plyometrique",
    "tapis",
    "mur",
    "marche",
    "appui_chevilles",
    "partenaire",
  ],
  home_bodyweight: [
    "aucun",
    "barre_traction",
    "barre_traction_neutre",
    "barres_paralleles",
    "anneaux",
    "elastique",
    "tapis",
    "mur",
    "box",
    "box_plyometrique",
    "banc",
    "marche",
    "corde_a_sauter",
    "ceinture_lest",
    "appui_chevilles",
    "partenaire",
  ],
  mixed: [], // mixed = treat as no filter, coach decides per session
};

export interface ProfileForRag {
  training_history?: string;
  training_environment?: TrainingEnvironment;
  available_equipment?: string[];
}

/**
 * Mappe le profil normalisé unifié (NormalizedProfile) vers la forme attendue
 * par le RAG exos. Centralisé pour que TOUS les appelants (sous-agent training,
 * routes coach/generate-plan) filtrent par niveau + équipement de façon
 * identique.
 *
 * Remplace l'ancien mapping inline `{ level, equipment } as ProfileForRag` qui,
 * via le cast `as`, masquait des noms de champs erronés (level/equipment au lieu
 * de training_history/available_equipment) → levelFromProfile retombait TOUJOURS
 * sur 'intermediaire' et equipmentFromProfile renvoyait TOUJOURS undefined :
 * filtres niveau ET équipement morts pour 100% des users (audit 2026-05-29).
 * Pas de cast large ici → TypeScript vérifie les noms de champs.
 */
export function buildProfileForRag(profile: NormalizedProfile): ProfileForRag {
  return {
    training_history: profile.training_level ?? undefined,
    training_environment:
      (profile.training_environment ?? undefined) as TrainingEnvironment | undefined,
    available_equipment: profile.equipment ?? undefined,
  };
}

export function levelFromProfile(profile: ProfileForRag | undefined): "debutant" | "intermediaire" | "avance" {
  const th = profile?.training_history;
  if (th === "beginner") return "debutant";
  if (th === "advanced") return "avance";
  return "intermediaire";
}

export function equipmentFromProfile(profile: ProfileForRag | undefined): string[] | undefined {
  if (!profile) return undefined;
  // Custom list takes precedence
  if (Array.isArray(profile.available_equipment) && profile.available_equipment.length > 0) {
    return profile.available_equipment;
  }
  const env = profile.training_environment;
  if (!env || env === "gym" || env === "mixed") return undefined;
  return ENV_EQUIPMENT[env];
}

/**
 * One-shot helper for the coach route. Retrieves top exercises + 1-2 methods
 * relevant to the user's last message, filtered by their profile, and returns
 * a ready-to-inject prompt fragment.
 *
 * Cost: 1 query embedding (~$0.00001) + 0 if indexes are loaded in RAM.
 * Latency: ~150-300 ms (embedding API round-trip).
 *
 * Returns an empty string if the query is too short / generic to warrant retrieval
 * (avoids polluting the prompt for "salut", "merci", etc.).
 */
export async function buildCoachRagFragment(
  query: string,
  profile: ProfileForRag | undefined,
): Promise<string> {
  if (!query || query.trim().length < 8) return "";

  const filter: ExerciseRetrievalFilter = {
    maxLevel: levelFromProfile(profile),
    availableEquipment: equipmentFromProfile(profile),
  };

  try {
    const [exoHits, methodHits] = await Promise.all([
      retrieveExercises(query, filter, 6),
      retrieveMethods(query, 2),
    ]);
    // Only inject methods if the top hit is a strong match (>0.55 cosine)
    // to avoid forcing an irrelevant method into the context.
    const goodMethods = methodHits.filter((h) => h.score > 0.55);
    return formatExercisesForPrompt(exoHits) + formatMethodsForPrompt(goodMethods);
  } catch (err) {
    console.warn("[rag-coach/context] retrieval failed, skipping:", err);
    return "";
  }
}

/**
 * For /api/ai/generate-plan: retrieve a broader set covering all essential
 * movement patterns, so the plan can pick from a curated subset filtered by
 * profile rather than seeing the full 250+ DB.
 *
 * Strategy: run 7 parallel retrieves (one per essential pattern + cardio)
 * then dedupe + format.
 */
export async function buildPlanRagFragment(
  profile: ProfileForRag | undefined,
): Promise<string> {
  const filter: ExerciseRetrievalFilter = {
    maxLevel: levelFromProfile(profile),
    availableEquipment: equipmentFromProfile(profile),
  };

  const patterns: Array<{ q: string; pattern?: string }> = [
    { q: "pousser horizontal pectoraux triceps", pattern: "push_horizontal" },
    { q: "pousser vertical épaules développé", pattern: "push_vertical" },
    { q: "tirer horizontal dos rowing", pattern: "pull_horizontal" },
    { q: "tirer vertical dos tractions", pattern: "pull_vertical" },
    { q: "squat quadriceps fessiers", pattern: "squat" },
    { q: "soulevé hinge ischio fessiers", pattern: "hinge" },
    { q: "core abdominaux gainage" },
    { q: "cardio conditioning métabolique" },
  ];

  try {
    const allHits = await Promise.all(
      patterns.map((p) =>
        retrieveExercises(p.q, { ...filter, pattern: p.pattern }, 5),
      ),
    );
    // Dedupe by id, keeping highest score
    const byId = new Map<string, (typeof allHits)[number][number]>();
    for (const hits of allHits) {
      for (const h of hits) {
        const prev = byId.get(h.id);
        if (!prev || h.score > prev.score) byId.set(h.id, h);
      }
    }
    const dedup = [...byId.values()].sort((a, b) => b.score - a.score);
    if (dedup.length === 0) return "";

    const block = `\n[BIBLIOTHÈQUE D'EXERCICES DISPONIBLES — ${dedup.length} exos filtrés pour ce profil]\n${dedup
      .map(
        (h) =>
          `- ${h.payload.name_fr} (${h.payload.level}) — primary: ${h.payload.primary_muscles.join(", ")} | pattern: ${h.payload.movement_pattern} | equipment: ${h.payload.equipment.join(", ")} | id: ${h.id}`,
      )
      .join("\n")}\n\nUtilise EXCLUSIVEMENT ces noms_fr exacts dans le champ \`name\` des exercices du programme.\n`;
    return block;
  } catch (err) {
    console.warn("[rag-coach/context] plan retrieval failed:", err);
    return "";
  }
}
