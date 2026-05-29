/**
 * Internal scientific corpus stored in Firestore.
 * Queried by the RAG pipeline alongside PubMed and FR authority sources.
 *
 * Seeded via scripts/seed-corpus.mjs into:
 *   content/sources_scientifiques/items/{ref_id}
 *   content/protocoles_seche/items/{protocol_id}
 */
import { adminDb } from "@/lib/firebase/admin";
import type { SearchResult } from "./client";

interface InternalSource {
  id: string;
  authors: string;
  year: number;
  title: string;
  journal: string;
  url: string | null;
  themes: string[];
  key_finding: string;
  coach_usage: string;
  citation_short: string;
}

interface InternalProtocol {
  id: string;
  weight_range: { min: number; max: number };
  phase: number;
  phase_label: string;
  duration_weeks: number;
  kcal_target: number;
  macros: { protein_g: number; lipids_g: number; carbs_g: number };
  macros_percent: { protein: number; lipids: number; carbs: number };
  meal_distribution: string;
  notes: string;
}

interface InternalNutritionGuide {
  id: string;
  source: string;
  source_title: string;
  section_number: number;
  section_title: string;
  themes: string[];
  summary: string;
  key_points?: string[];
  coach_usage: string;
  target_audience?: string;
  references_consulted?: string[];
}

/**
 * Maps user query keywords to internal corpus themes.
 * The matching is intentionally loose: a query that mentions "protein"
 * or "muscle" should match the "proteines" theme.
 */
const THEME_KEYWORDS: Record<string, string[]> = {
  metabolisme_base: [
    "métabolisme",
    "metabolisme",
    "maintenance",
    "tdee",
    "calorique",
    "kcal",
    "mb",
    "rmr",
  ],
  adaptation_metabolique: [
    "plateau",
    "thermogenèse",
    "adaptation",
    "diet break",
    "refeed",
    "stagnation",
  ],
  vitesse_perte: [
    "vitesse",
    "perte",
    "rapide",
    "lent",
    "rythme",
    "semaine",
    "kg",
  ],
  proteines: [
    "protéine",
    "proteine",
    "whey",
    "leucine",
    "musculaire",
    "muscle",
    "fractionnement",
    "shake",
  ],
  preservation_masse_maigre: [
    "masse maigre",
    "masse musculaire",
    "ffm",
    "préserver",
    "preserver",
    "catabolisme",
  ],
  cardio_liss: [
    "cardio",
    "marche",
    "vélo",
    "velo",
    "liss",
    "fat-max",
    "lipolyse",
    "endurance",
  ],
  fcmax: [
    "fréquence cardiaque",
    "frequence cardiaque",
    "fcmax",
    "tanaka",
    "zone cible",
    "bpm",
  ],
  nutrition_peri_entrainement: [
    "entraînement",
    "entrainement",
    "post-workout",
    "péri",
    "timing",
    "anabolique",
    "mtor",
  ],
  consensus_officiel: [
    "issn",
    "consensus",
    "position",
    "stand",
    "recommandation",
  ],
  prep_seche: ["sèche", "seche", "cut", "compétition", "preparation", "prep"],
  complements: [
    "complément",
    "complement",
    "créatine",
    "creatine",
    "caféine",
    "cafeine",
    "bêta-alanine",
    "beta-alanine",
    "magnésium",
    "supplement",
  ],
  oxydation_lipides: ["graisse", "lipide", "oxydation", "fat-max", "substrat"],
  // Themes spécifiques aux nutrition_guides Ottawa P1208
  gestion_poids: ["poids", "kilos", "minceur", "obésité", "obesite", "perdre", "maigrir"],
  principes: ["principe", "cadre", "approche", "philosophie", "fondamental"],
  long_terme: ["long terme", "durable", "maintien", "permanent"],
  objectifs_realistes: ["objectif", "but", "réaliste", "realiste", "rapide", "miracle"],
  evaluation: ["évaluer", "evaluer", "habitudes", "questionnaire", "diagnostic", "bilan"],
  questionnaire: ["question", "demander", "comment", "interroger"],
  habitudes: ["habitude", "routine", "quotidien", "tous les jours"],
  diagnostic_initial: ["initial", "départ", "depart", "commencer", "début", "debut"],
  assiette: ["assiette", "portion", "équilibrer", "equilibrer", "menu", "repas", "plat"],
  equilibre: ["équilibre", "equilibre", "balance", "varié", "varie"],
  macros: ["macro", "macronutriment", "glucide", "lipide", "protéine", "proteine"],
  regle_visuelle: ["visuel", "voir", "regarder", "simple", "facile"],
  besoins_journaliers: ["besoin", "journalier", "quotidien", "par jour", "ration"],
  satiete: ["faim", "satiété", "satiete", "rassasié", "rassasie", "estomac", "ventre", "plein"],
  mindful_eating: ["mindful", "conscience", "écoute", "ecoute", "lentement", "mastiquer", "savourer"],
  auto_regulation: ["régulation", "regulation", "contrôle", "controle", "écouter son corps"],
  echelle: ["échelle", "echelle", "niveau", "intensité", "intensite", "noter"],
};

function scoreSource(source: InternalSource, normalizedQuery: string): number {
  let score = 0;
  for (const theme of source.themes) {
    const keywords = THEME_KEYWORDS[theme] ?? [];
    for (const keyword of keywords) {
      if (normalizedQuery.includes(keyword)) {
        score += 1;
      }
    }
  }
  // Bonus si la query mentionne directement le nom de l'auteur
  const firstAuthorLast = source.authors.split(",")[0]?.split(" ")[0] ?? "";
  if (
    firstAuthorLast.length > 3 &&
    normalizedQuery.includes(firstAuthorLast.toLowerCase())
  ) {
    score += 3;
  }
  return score;
}

/**
 * Search internal corpus of curated scientific references.
 * Returns top N matches scored by theme keyword overlap.
 */
export async function searchInternalCorpus(
  query: string,
  limit = 3,
): Promise<SearchResult[]> {
  try {
    const snapshot = await adminDb
      .collection("content")
      .doc("sources_scientifiques")
      .collection("items")
      .get();

    if (snapshot.empty) {
      console.warn("[internal-corpus] no sources found in Firestore");
      return [];
    }

    const normalizedQuery = query.toLowerCase();
    const scored: { source: InternalSource; score: number }[] = [];

    snapshot.forEach((doc) => {
      const source = doc.data() as InternalSource;
      const score = scoreSource(source, normalizedQuery);
      if (score > 0) scored.push({ source, score });
    });

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, limit).map(({ source }) => ({
      title: source.title,
      authors: source.citation_short, // already a short attribution like "Helms 2014"
      source: source.journal,
      year: String(source.year),
      url: source.url ?? "",
      abstractSnippet: source.key_finding,
      language: "en" as const,
    }));
  } catch (err) {
    console.error("[internal-corpus] query failed:", err);
    return [];
  }
}

function scoreNutritionGuide(
  guide: InternalNutritionGuide,
  normalizedQuery: string,
): number {
  let score = 0;
  for (const theme of guide.themes) {
    const keywords = THEME_KEYWORDS[theme] ?? [];
    for (const keyword of keywords) {
      if (normalizedQuery.includes(keyword)) {
        score += 1;
      }
    }
  }
  return score;
}

/**
 * Search the nutrition guides corpus (Hôpital d'Ottawa P1208).
 * Complémentaire à searchInternalCorpus : les guides Ottawa donnent un
 * cadre patient-friendly (modèle d'assiette, échelle de faim, objectifs
 * réalistes) que les sources scientifiques pures ne couvrent pas.
 *
 * Le coach les recevra dans le bloc [SOURCES SCIENTIFIQUES] existant via
 * client.ts → searchScientificCorpus().
 */
export async function searchNutritionGuides(
  query: string,
  limit = 2,
): Promise<SearchResult[]> {
  try {
    const snapshot = await adminDb
      .collection("content")
      .doc("nutrition_guides")
      .collection("items")
      .get();

    if (snapshot.empty) {
      console.warn("[internal-corpus] no nutrition guides found in Firestore");
      return [];
    }

    const normalizedQuery = query.toLowerCase();
    const scored: { guide: InternalNutritionGuide; score: number }[] = [];

    snapshot.forEach((doc) => {
      const guide = doc.data() as InternalNutritionGuide;
      const score = scoreNutritionGuide(guide, normalizedQuery);
      if (score > 0) scored.push({ guide, score });
    });

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, limit).map(({ guide }) => ({
      title: guide.section_title,
      authors: "Hôpital d'Ottawa",
      source: "Plan d'alimentation pour la gestion du poids (P1208, 2015)",
      year: "2015",
      url: "",
      abstractSnippet: guide.summary,
      language: "fr" as const,
    }));
  } catch (err) {
    console.error("[internal-corpus] nutrition guides query failed:", err);
    return [];
  }
}

/**
 * Fetch the nutrition protocol matching a user's current weight and phase.
 * Used by the context-builder to attach a relevant meal plan to the coach
 * prompt without bloating it with all 12 protocols.
 */
export async function getProtocolForUser(
  weightKg: number,
  phase: 1 | 2 | 3 = 1,
): Promise<InternalProtocol | null> {
  try {
    const snapshot = await adminDb
      .collection("content")
      .doc("protocoles_seche")
      .collection("items")
      .where("phase", "==", phase)
      .get();

    if (snapshot.empty) return null;

    for (const doc of snapshot.docs) {
      const protocol = doc.data() as InternalProtocol;
      if (
        weightKg >= protocol.weight_range.min &&
        weightKg <= protocol.weight_range.max
      ) {
        return protocol;
      }
    }
    return null;
  } catch (err) {
    console.error("[internal-corpus] protocol lookup failed:", err);
    return null;
  }
}
