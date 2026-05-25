// Seed du corpus interne dans Firestore.
// Pousse 16 sources scientifiques + 12 protocoles nutritionnels
// dans content/sources_scientifiques/ et content/protocoles_seche/
//
// Usage :
//   node scripts/seed-corpus.mjs
//
// Nécessite les env vars Firebase Admin (déjà set dans .env.local et Vercel) :
//   FIREBASE_ADMIN_PROJECT_ID
//   FIREBASE_ADMIN_CLIENT_EMAIL
//   FIREBASE_ADMIN_PRIVATE_KEY

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Try to load .env.local manually (no dotenv dep)
const envPath = join(__dirname, "..", ".env.local");
if (existsSync(envPath)) {
  const lines = readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
let privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

if (!projectId || !clientEmail || !privateKey) {
  console.error(
    "Missing Firebase Admin env vars. Need FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY in .env.local",
  );
  process.exit(1);
}

// Vercel-style \n need to be unescaped
privateKey = privateKey.replace(/\\n/g, "\n");

if (!getApps().length) {
  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

const db = getFirestore();

// ============================================================
// SOURCES SCIENTIFIQUES (16 docs)
// ============================================================
const sources = [
  {
    id: "frankenfield-2005",
    authors: "Frankenfield DC, Roth-Yousey L, Compher C",
    year: 2005,
    title:
      "Comparison of Predictive Equations for Resting Metabolic Rate in Healthy Nonobese and Obese Adults: A Systematic Review",
    journal: "Journal of the American Dietetic Association",
    volume_pages: "105(5), 775-789",
    doi: "10.1016/j.jada.2005.02.005",
    url: "https://doi.org/10.1016/j.jada.2005.02.005",
    study_type: "Revue systématique",
    themes: ["metabolisme_base", "calcul_maintenance"],
    key_finding:
      "Mifflin-St Jeor est l'équation la plus fiable chez le non-obèse (~82% précision à ±10% du MB mesuré). Toutes les équations perdent en précision chez l'obèse.",
    coach_usage:
      "Privilégier Mifflin-St Jeor sur Harris-Benedict pour calculer la maintenance calorique.",
    citation_short: "Frankenfield 2005",
  },
  {
    id: "rosenbaum-2010",
    authors: "Rosenbaum M, Leibel RL",
    year: 2010,
    title: "Adaptive thermogenesis in humans",
    journal: "International Journal of Obesity",
    volume_pages: "34(S1), S47-S55",
    doi: "10.1038/ijo.2010.184",
    url: "https://doi.org/10.1038/ijo.2010.184",
    study_type: "Revue narrative",
    themes: ["adaptation_metabolique", "plateau_seche"],
    key_finding:
      "Après perte de poids ≥10%, la dépense énergétique totale baisse de 300-500 kcal/jour au-delà de ce qu'expliquerait la composition corporelle. Phénomène persistant plusieurs années.",
    coach_usage:
      "Anticiper le plateau de sèche, planifier refeeds / diet breaks.",
    citation_short: "Rosenbaum 2010",
  },
  {
    id: "pasiakos-2013",
    authors: "Pasiakos SM, Cao JJ, Margolis LM, et al.",
    year: 2013,
    title:
      "Effects of high-protein diets on fat-free mass and muscle protein synthesis following weight loss",
    journal: "The FASEB Journal",
    volume_pages: "27(9), 3837-3847",
    doi: "10.1096/fj.13-230227",
    url: "https://doi.org/10.1096/fj.13-230227",
    study_type: "RCT",
    themes: ["proteines", "preservation_masse_maigre"],
    key_finding:
      "Doubler ou tripler l'apport protéique (1.6-2.4 g/kg vs 0.8 g/kg) durant un déficit de ~40% préserve significativement la masse maigre.",
    coach_usage:
      "Socle scientifique pour la cible protéique en cut : 2.2-2.5 g/kg de poids corporel.",
    citation_short: "Pasiakos 2013",
  },
  {
    id: "trexler-2014-cv",
    authors: "Trexler ET, Smith-Ryan AE, Norton LE",
    year: 2014,
    title:
      "Effects of caloric restriction on cardiovascular risk factors and inflammation in overweight individuals",
    journal: "Metabolism",
    volume_pages: "63(12), 1616-1624",
    doi: "10.1016/j.metabol.2014.09.010",
    url: "https://doi.org/10.1016/j.metabol.2014.09.010",
    study_type: "RCT",
    themes: ["restriction_calorique", "cardio_metabolique"],
    key_finding:
      "Restriction calorique améliore facteurs de risque cardiovasculaires et inflammation chez sujets en surpoids.",
    coach_usage:
      "Argument que la restriction calorique a aussi des bénéfices cardio-métaboliques.",
    citation_short: "Trexler 2014",
  },
  {
    id: "hawley-2011",
    authors: "Hawley JA, Burke LM, Phillips SM, Spriet LL",
    year: 2011,
    title: "Nutritional modulation of training-induced skeletal muscle adaptations",
    journal: "Journal of Applied Physiology",
    volume_pages: "110(3), 834-845",
    doi: "10.1152/japplphysiol.00949.2010",
    url: "https://doi.org/10.1152/japplphysiol.00949.2010",
    study_type: "Revue",
    themes: ["nutrition_peri_entrainement", "adaptations_musculaires"],
    key_finding:
      "La disponibilité en glucides et protéines autour de l'entraînement module fortement les signaux anaboliques (mTOR, AMPK, PGC-1α).",
    coach_usage:
      "Justifier le timing des glucides autour de la séance en sèche pour préserver l'intensité.",
    citation_short: "Hawley 2011",
  },
  {
    id: "romijn-1993",
    authors:
      "Romijn JA, Coyle EF, Sidossis LS, Gastaldelli A, Horowitz JF, Endert E, Wolfe RR",
    year: 1993,
    title:
      "Regulation of endogenous fat and carbohydrate metabolism in relation to exercise intensity and duration",
    journal: "The American Journal of Physiology",
    volume_pages: "265(3 Pt 1), E380-E391",
    doi: "10.1152/ajpendo.1993.265.3.E380",
    url: "https://doi.org/10.1152/ajpendo.1993.265.3.E380",
    study_type: "Étude expérimentale (traceurs isotopiques)",
    themes: ["cardio_liss", "oxydation_lipides", "substrats_energie"],
    key_finding:
      "À 25% VO2max, graisses fournissent ~80% de l'énergie. À 65% VO2max, oxydation absolue des graisses maximale (fat-max zone). Au-dessus de 85% VO2max, glucides dominent.",
    coach_usage:
      "Référence canonique pour justifier le cardio LISS en sèche.",
    citation_short: "Romijn 1993",
  },
  {
    id: "tanaka-2001",
    authors: "Tanaka H, Monahan KD, Seals DR",
    year: 2001,
    title: "Age-predicted maximal heart rate revisited",
    journal: "Journal of the American College of Cardiology",
    volume_pages: "37(1), 153-156",
    doi: "10.1016/S0735-1097(00)01157-8",
    url: "https://doi.org/10.1016/S0735-1097(00)01157-8",
    study_type: "Méta-analyse + étude de validation",
    themes: ["fcmax", "cardio"],
    key_finding:
      "FCmax = 208 − (0,7 × âge). Méta-analyse 351 études (N=18 712) + validation N=514. Valide indépendamment du sexe et niveau d'activité. SE ~10 bpm au niveau individuel.",
    coach_usage:
      "Calculer la zone cardio LISS = FCmax × 0,6 (1er seuil ventilatoire).",
    citation_short: "Tanaka 2001",
  },
  {
    id: "helge-2017",
    authors: "Helge JW",
    year: 2017,
    title:
      "Exercise-induced metabolic perturbations and mitochondrial dysfunction: a debate",
    journal: "Journal of Physiology",
    volume_pages: "595(14), 4687-4696",
    doi: "10.1113/JP273046",
    url: "https://doi.org/10.1113/JP273046",
    study_type: "Débat / commentaire",
    themes: ["mitochondries", "fatigue_metabolique"],
    key_finding:
      "Débat sur perturbations métaboliques induites par l'exercice et dysfonction mitochondriale en contexte de déficit énergétique.",
    coach_usage: "Référence pour la fatigue mitochondriale en déficit.",
    citation_short: "Helge 2017",
  },
  {
    id: "garthe-2011",
    authors:
      "Garthe I, Raastad T, Refsnes PE, Koivisto A, Sundgot-Borgen J",
    year: 2011,
    title:
      "Effect of two different weight-loss rates on body composition and strength and power-related performance in elite athletes",
    journal:
      "International Journal of Sport Nutrition and Exercise Metabolism",
    volume_pages: "21(2), 97-104",
    doi: "10.1123/ijsnem.21.2.97",
    url: "https://doi.org/10.1123/ijsnem.21.2.97",
    study_type: "RCT",
    themes: ["vitesse_perte", "preservation_masse_maigre", "athletes"],
    key_finding:
      "Perte lente (0.7%/sem) vs rapide (1.4%/sem) chez athlètes élite (N=24, 5-12 sem). Lent: -5.6% MG, +2.1% MM, +11.9% force DC, +4% squat. Rapide: -3.0% MG, MM inchangée, gains de force moindres.",
    coach_usage:
      "RÉFÉRENCE CANONIQUE — vitesse de perte ≤ 0.7%/sem pour préserver les performances athlétiques.",
    citation_short: "Garthe 2011",
  },
  {
    id: "phillips-vanloon-2011",
    authors: "Phillips SM, Van Loon LJ",
    year: 2011,
    title:
      "Dietary protein for athletes: from requirements to metabolic advantage",
    journal: "Applied Physiology, Nutrition, and Metabolism",
    volume_pages: "37(5), 67-76",
    doi: "10.1139/h11-009",
    url: "https://doi.org/10.1139/h11-009",
    study_type: "Revue",
    themes: ["proteines", "fractionnement", "athletes"],
    key_finding:
      "Recommandation 1.3-1.8 g/kg/jour en maintenance, à répartir en 4-6 prises de 0.25-0.40 g/kg toutes les 3-4h. Apports plus élevés justifiés en cut.",
    coach_usage:
      "Socle pour la stratégie de fractionnement protéique sur la journée.",
    citation_short: "Phillips & Van Loon 2011",
  },
  {
    id: "tipton-2018",
    authors: "Tipton KD, Hamilton DL, Gallagher IJ, et al.",
    year: 2018,
    title:
      "Protein metabolism in female endurance-trained athletes in the luteal phase of the menstrual cycle",
    journal: "The FASEB Journal",
    volume_pages: "32(1), 357-358",
    doi: "10.1096/fasebj.2018.32.1_supplement.357.1",
    url: "https://doi.org/10.1096/fasebj.2018.32.1_supplement.357.1",
    study_type: "Abstract de conférence",
    themes: ["proteines", "femmes", "cycle_menstruel"],
    key_finding:
      "Métabolisme protéique chez athlètes féminines en phase lutéale du cycle menstruel.",
    coach_usage:
      "Très spécifique. Marginal pour le cadre général de la sèche masculine.",
    citation_short: "Tipton 2018",
  },
  {
    id: "jager-2017",
    authors:
      "Jäger R, Kerksick CM, Campbell BI, Cribb PJ, Wells SD, Skwiat TM, et al.",
    year: 2017,
    title:
      "International Society of Sports Nutrition Position Stand: protein and exercise",
    journal: "Journal of the International Society of Sports Nutrition",
    volume_pages: "14(1), 20",
    doi: "10.1186/s12970-017-0177-8",
    url: "https://doi.org/10.1186/s12970-017-0177-8",
    study_type: "Position stand officielle (ISSN)",
    themes: ["proteines", "consensus_officiel"],
    key_finding:
      "1.4-2.0 g/kg/jour pour la plupart des sportifs. En déficit énergétique : jusqu'à 2.3-3.1 g/kg MM. Doses optimales 0.25-0.40 g/kg par prise (20-40g). Fenêtre anabolique jusqu'à 24h post-exercice. Whey, caséine, œuf, bœuf = meilleurs en leucine.",
    coach_usage:
      "Référence consensus la plus solide. À citer en priorité pour tout calcul de cible protéique.",
    citation_short: "ISSN Jäger 2017",
  },
  {
    id: "helms-2014",
    authors: "Helms ER, Aragon AA, Fitschen PJ",
    year: 2014,
    title:
      "Evidence-based recommendations for natural bodybuilding contest preparation: nutrition and supplementation",
    journal: "Journal of the International Society of Sports Nutrition",
    volume_pages: "11(1), 20",
    doi: "10.1186/1550-2783-11-20",
    url: "https://doi.org/10.1186/1550-2783-11-20",
    study_type: "Revue evidence-based",
    themes: [
      "prep_seche",
      "macros",
      "vitesse_perte",
      "refeeds",
      "complements",
      "cardio",
    ],
    key_finding:
      "Vitesse perte 0.5-1%/sem PC. Protéines 2.3-3.1 g/kg MM. Lipides 15-30% kcal, jamais <20% chez homme (testo). Glucides = reste. Refeeds/diet breaks justifiés. Compléments validés: créatine 3-5g, caféine, bêta-alanine. Cardio = outil ajustable, pas base.",
    coach_usage:
      "RÉFÉRENCE INCONTOURNABLE pour toute prep sèche orientée bodybuilding/physique.",
    citation_short: "Helms 2014",
  },
  {
    id: "aragon-2017",
    authors:
      "Aragon AA, Schoenfeld BJ, Wildman R, Kleiner S, VanDusseldorp T, Taylor L, Antonio J, et al.",
    year: 2017,
    title:
      "International Society of Sports Nutrition Position Stand: diets and body composition",
    journal: "Journal of the International Society of Sports Nutrition",
    volume_pages: "14(1), 16",
    doi: "10.1186/s12970-017-0174-y",
    url: "https://doi.org/10.1186/s12970-017-0174-y",
    study_type: "Position stand officielle (ISSN)",
    themes: ["regimes", "composition_corporelle", "consensus_officiel"],
    key_finding:
      "Aucune approche diététique universellement supérieure — c'est le déficit calorique + adhérence qui priment. Hypocalorique + protéines élevées + résistance = rétention masse maigre maximale. Timing nutriments : impact modéré vs apport total. Distribution 3-6 prises de 20-40g espacées 3-4h.",
    coach_usage:
      "À combiner systématiquement avec Helms 2014 et Jäger 2017 pour le socle de la sèche.",
    citation_short: "ISSN Aragon 2017",
  },
  {
    id: "michal-schomburg-2012",
    authors: "Michal G, Schomburg D",
    year: 2012,
    title: "Biochemical Pathways: An Atlas of Biochemistry and Molecular Biology",
    journal: "Wiley (ouvrage)",
    volume_pages: null,
    doi: null,
    url: null,
    study_type: "Ouvrage de référence",
    themes: ["biochimie", "voies_metaboliques"],
    key_finding:
      "Atlas des voies biochimiques (ATP, mitochondries, glycolyse, bêta-oxydation).",
    coach_usage: "Ouvrage de fond, pas exploitable pour citer un finding précis.",
    citation_short: "Michal & Schomburg 2012",
  },
];

// ============================================================
// PROTOCOLES NUTRITIONNELS (4 tranches × 3 phases = 12 docs)
// Simplifié : on stocke les targets caloriques/macros par phase
// + un sample représentatif des repas (pas l'intégralité des 180
// variantes — un sample suffit pour le RAG, le full reste dans le MD).
// ============================================================

function buildProtocol(weightMin, weightMax, phase, kcal, p, l, g, label) {
  return {
    id: `protocol-${weightMin}-${weightMax}kg-phase${phase}`,
    weight_range: { min: weightMin, max: weightMax },
    phase,
    phase_label: label,
    duration_weeks: 3,
    kcal_target: kcal,
    macros: { protein_g: p, lipids_g: l, carbs_g: g },
    macros_percent: {
      protein: Math.round(((p * 4) / kcal) * 100),
      lipids: Math.round(((l * 9) / kcal) * 100),
      carbs: Math.round(((g * 4) / kcal) * 100),
    },
    meal_distribution: "5 repas par jour, espacés de 2-3h",
    references_consulted: [
      "helms-2014",
      "jager-2017",
      "aragon-2017",
      "garthe-2011",
    ],
    notes:
      "Plan structuré sur 3 phases progressives (acclimatation → déficit moyen → finition). Voir docs/corpus/corpus-seche-protocoles.md pour les variantes de repas complètes.",
  };
}

const protocols = [
  // 80-85 kg
  buildProtocol(80, 85, 1, 3000, 177, 83, 388, "Acclimatation"),
  buildProtocol(80, 85, 2, 2786, 166, 70, 372, "Déficit moyen"),
  buildProtocol(80, 85, 3, 2465, 179, 73, 273, "Finition"),
  // 90-95 kg
  buildProtocol(90, 95, 1, 3254, 191, 91, 417, "Acclimatation"),
  buildProtocol(90, 95, 2, 2968, 193, 77, 379, "Déficit moyen"),
  buildProtocol(90, 95, 3, 2685, 206, 77, 292, "Finition"),
  // 100-105 kg
  buildProtocol(100, 105, 1, 3408, 215, 100, 412, "Acclimatation"),
  buildProtocol(100, 105, 2, 3167, 211, 87, 384, "Déficit moyen"),
  buildProtocol(100, 105, 3, 2792, 220, 84, 289, "Finition"),
  // 110+ kg
  buildProtocol(110, 200, 1, 3634, 223, 110, 438, "Acclimatation"),
  buildProtocol(110, 200, 2, 3343, 221, 95, 401, "Déficit moyen"),
  buildProtocol(110, 200, 3, 3005, 232, 93, 310, "Finition"),
];

// ============================================================
// PUSH TO FIRESTORE
// ============================================================

async function seedSources() {
  console.log(`Seeding ${sources.length} scientific sources...`);
  const batch = db.batch();
  for (const source of sources) {
    const ref = db.collection("content").doc("sources_scientifiques").collection("items").doc(source.id);
    batch.set(ref, source);
  }
  await batch.commit();
  console.log(`✅ ${sources.length} sources written to content/sources_scientifiques/items/`);
}

async function seedProtocols() {
  console.log(`Seeding ${protocols.length} nutrition protocols...`);
  const batch = db.batch();
  for (const protocol of protocols) {
    const ref = db.collection("content").doc("protocoles_seche").collection("items").doc(protocol.id);
    batch.set(ref, protocol);
  }
  await batch.commit();
  console.log(`✅ ${protocols.length} protocols written to content/protocoles_seche/items/`);
}

async function main() {
  console.log(`Project: ${projectId}`);
  await seedSources();
  await seedProtocols();
  console.log("Done.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
