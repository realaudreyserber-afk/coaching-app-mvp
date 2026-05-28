/**
 * POST /api/profile/update-fields
 *
 * Allows the Coach IA to persist data it elicits in conversation
 * directly into users/{uid}. The request body lists field paths
 * (dot-notation) to merge into the user document.
 *
 * Whitelisted paths only — protects against the LLM trying to write
 * arbitrary fields. Each value is range-validated server-side.
 *
 * Called by the frontend after parsing <COACH_SAVE>{...}</COACH_SAVE>
 * blocks emitted by the coach in its replies (see lib/vertex/prompts/coach.ts).
 */
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { MEASUREMENT_FIELDS } from "@/lib/features/measurements/schema";
import { archiveGoalsBeforeChange } from "@/lib/features/goals-history/store";

type FieldValue = string | number | boolean | null | string[];

interface FieldSpec {
  type: "string" | "number" | "boolean" | "string_array";
  min?: number;
  max?: number;
  enum?: string[];
  /** For string_array : max items in the array, max chars per item */
  maxItems?: number;
  maxItemLen?: number;
  /** For string_array : whitelist of allowed item values (e.g. equipment slugs) */
  itemEnum?: string[];
}

// Whitelist of writable paths with type + range validation.
// Anything outside this map is silently rejected.
const ALLOWED_FIELDS: Record<string, FieldSpec> = {
  // profile
  "profile.name": { type: "string", max: 60 },
  "profile.age": { type: "number", min: 13, max: 100 },
  "profile.height": { type: "number", min: 100, max: 250 },
  "profile.weight": { type: "number", min: 30, max: 300 },
  "profile.sex": { type: "string", enum: ["male", "female", "other"] },
  "profile.activity_level": {
    type: "string",
    enum: ["sedentary", "light", "moderate", "active", "very_active"],
  },
  "profile.training_frequency": { type: "string", max: 60 },
  "profile.training_history": {
    type: "string",
    enum: ["beginner", "intermediate", "advanced"],
  },
  "profile.training_environment": {
    type: "string",
    enum: ["gym", "home_gym", "home_bodyweight", "mixed"],
  },
  // Wave 6 review item 6 : allow coach to persist the user's actual equipment
  // list via <COACH_SAVE>. Item slugs match lib/features/exercises/database.json
  // `equipment` field whitelist + lib/features/rag-coach/context.ts ENV_EQUIPMENT.
  "profile.available_equipment": {
    type: "string_array",
    maxItems: 30,
    maxItemLen: 40,
    itemEnum: [
      "aucun", "barre", "barre_ez", "halteres", "haltere",
      "banc_plat", "banc_incline", "banc_decline", "banc_dossier",
      "banc_predicateur", "banc_hyperext", "rack",
      "barre_traction", "barre_traction_neutre", "barres_paralleles",
      "kettlebells", "kettlebell", "anneaux", "elastique",
      "disques", "disque", "trap_bar", "ceinture_lest", "roue_abdo",
      "corde_a_sauter", "box", "box_plyometrique", "tapis", "mur",
      "marche", "appui_chevilles", "partenaire", "banc", "sled",
      "battle_ropes", "machine_chest_press", "machine_pec_deck",
      "machine_pulldown", "poulie_haute", "poulie_basse", "poulies_doubles",
      "corde", "barre_droite", "poignee_v", "machine_row",
      "machine_chest_supported", "landmine", "machine_shrug",
      "machine_shoulder_press", "machine_hack_squat", "machine_leg_press",
      "machine_leg_extension", "machine_leg_curl_assis", "machine_leg_curl_couche",
      "machine_abduction", "machine_mollets_debout", "machine_mollets_assis",
      "machine_donkey", "sissy_bench", "farmer_handles", "stair_climber",
      "rameur", "ski_erg", "air_bike", "tapis_motorise",
    ],
  },
  "profile.timezone": { type: "string", max: 50 },
  "profile.waist_cm": { type: "number", min: 40, max: 200 },
  "profile.neck_cm": { type: "number", min: 25, max: 70 },
  "profile.hips_cm": { type: "number", min: 50, max: 200 },
  // Mensurations complémentaires — exploitables par le prompt §12 du coach
  // (ratios McCallum, Adonis Index, indices esthétiques).
  "profile.shoulder_cm": { type: "number", min: 90, max: 180 },
  "profile.chest_cm": { type: "number", min: 60, max: 180 },
  "profile.arm_cm": { type: "number", min: 20, max: 65 },
  "profile.forearm_cm": { type: "number", min: 15, max: 50 },
  "profile.wrist_cm": { type: "number", min: 10, max: 25 },
  "profile.thigh_cm": { type: "number", min: 30, max: 100 },
  "profile.calf_cm": { type: "number", min: 20, max: 60 },
  "profile.bf_method": {
    type: "string",
    enum: ["dexa", "bodpod", "inbody", "caliper", "navy", "bia", "photo", "unknown"],
  },
  "profile.hormonal_context": {
    type: "string",
    enum: ["natural", "trt", "cycle", "post_menopause", "other"],
  },
  "profile.medical_notes": { type: "string", max: 1000 },
  "profile.tdee_theoretical": { type: "number", min: 800, max: 6000 },
  "profile.tdee_adaptive": { type: "number", min: 800, max: 6000 },
  // Phase 9 data-layer : préférences alimentaires et allergies
  "profile.dietary_preferences": {
    type: "string_array",
    maxItems: 8,
    maxItemLen: 30,
    itemEnum: [
      "vegetarian", "vegan", "pescetarian", "halal", "kosher",
      "gluten_free", "lactose_free", "low_fodmap", "keto",
    ],
  },
  "profile.allergies": { type: "string_array", maxItems: 20, maxItemLen: 50 },
  "profile.dislikes": { type: "string_array", maxItems: 30, maxItemLen: 50 },
  // baseline
  "baseline.weight": { type: "number", min: 30, max: 300 },
  "baseline.bf_pct": { type: "number", min: 3, max: 60 },
  "baseline.bf_measured_at": { type: "string", max: 40 },
  // goals
  "goals.primary_goal": { type: "string", max: 60 },
  "goals.target_weight": { type: "number", min: 30, max: 300 },
  "goals.target_bf_pct": { type: "number", min: 3, max: 40 },
  "goals.type": { type: "string", max: 60 },
  "goals.deadline": { type: "string", max: 40 },
};

function validateField(path: string, value: FieldValue): { ok: boolean; reason?: string } {
  const spec = ALLOWED_FIELDS[path];
  if (!spec) return { ok: false, reason: "field_not_allowed" };
  if (value === null) return { ok: true }; // allow clearing
  if (spec.type === "string_array") {
    if (!Array.isArray(value)) return { ok: false, reason: "not_an_array" };
    if (spec.maxItems !== undefined && value.length > spec.maxItems) {
      return { ok: false, reason: "too_many_items" };
    }
    for (const item of value) {
      if (typeof item !== "string") return { ok: false, reason: "item_not_string" };
      if (spec.maxItemLen !== undefined && item.length > spec.maxItemLen) {
        return { ok: false, reason: "item_too_long" };
      }
      if (spec.itemEnum && !spec.itemEnum.includes(item)) {
        return { ok: false, reason: `item_not_in_enum:${item}` };
      }
    }
    return { ok: true };
  }
  if (typeof value !== spec.type) return { ok: false, reason: "type_mismatch" };
  if (spec.type === "number" && typeof value === "number") {
    if (spec.min !== undefined && value < spec.min) return { ok: false, reason: "below_min" };
    if (spec.max !== undefined && value > spec.max) return { ok: false, reason: "above_max" };
  }
  if (spec.type === "string" && typeof value === "string") {
    if (spec.max !== undefined && value.length > spec.max) return { ok: false, reason: "too_long" };
    if (spec.enum && !spec.enum.includes(value)) return { ok: false, reason: "not_in_enum" };
  }
  return { ok: true };
}

export async function POST(req: NextRequest) {
  // 1. Auth
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const idToken = authHeader.slice(7);

  let uid: string | null = null;
  const isMockEnabled =
    process.env.ENABLE_MOCK_AUTH === "1" || process.env.NODE_ENV !== "production";
  if (
    isMockEnabled &&
    (idToken === "mock-token" ||
      idToken === "mock-token-non-admin" ||
      idToken === "mock-token-no-profile")
  ) {
    uid = idToken === "mock-token-non-admin"
      ? "non-admin-user-id"
      : idToken === "mock-token-no-profile"
        ? "no-profile-user-id"
        : "dev-user-id";
  } else {
    try {
      const decoded = await adminAuth.verifyIdToken(idToken);
      uid = decoded.uid;
    } catch (err) {
      console.error("[profile/update-fields] token verify failed:", err);
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
  }
  if (!uid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse body
  let body: { updates?: Record<string, FieldValue> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const updates = body?.updates;
  if (!updates || typeof updates !== "object") {
    return NextResponse.json({ error: "Missing 'updates' object" }, { status: 400 });
  }

  // 3. Validate every field
  const accepted: Record<string, FieldValue> = {};
  const rejected: Record<string, string> = {};
  for (const [path, value] of Object.entries(updates)) {
    const v = validateField(path, value);
    if (v.ok) accepted[path] = value;
    else rejected[path] = v.reason ?? "invalid";
  }

  if (Object.keys(accepted).length === 0) {
    return NextResponse.json(
      { ok: false, accepted: {}, rejected },
      { status: 400 },
    );
  }

  // 4. Build dot-notation update payload + apply via admin
  try {
    // Phase 10 data-layer : avant d'écrire un patch goals.*, snapshot l'ancien
    // dans goals_history/ pour préserver l'historique des changements.
    await archiveGoalsBeforeChange(uid, accepted as Record<string, unknown>).catch((e) => {
      console.warn("[profile/update-fields] goals archive failed:", e);
    });

    const userRef = adminDb.collection("users").doc(uid);
    await userRef.set(buildNestedPayload(accepted), { merge: true });

    // Side effect : si des champs mensurations ont été patchés via profile.*_cm,
    // les propager aussi dans la collection measurements/{today} pour avoir
    // l'historique time-series (fix bug data : profile.*_cm était uniquement
    // la dernière valeur, l'historique était perdu).
    await maybePropagateMeasurements(uid, accepted).catch((e) => {
      console.warn("[profile/update-fields] measurements propagation failed:", e);
      // best-effort — l'écriture profile a réussi, ne pas bloquer
    });

    return NextResponse.json({ ok: true, accepted, rejected });
  } catch (err) {
    console.error("[profile/update-fields] write failed:", err);
    return NextResponse.json({ error: "Write failed" }, { status: 500 });
  }
}

/**
 * Si l'update inclut un ou plusieurs champs mensurations (profile.waist_cm,
 * profile.neck_cm, etc.), écrit (merge) un doc dans measurements/{today}
 * avec ces valeurs. Préserve l'historique time-series.
 */
async function maybePropagateMeasurements(
  uid: string,
  accepted: Record<string, FieldValue>,
): Promise<void> {
  const measurementPatch: Record<string, number> = {};
  for (const field of MEASUREMENT_FIELDS) {
    const path = `profile.${field}`;
    const value = accepted[path];
    if (typeof value === "number") {
      measurementPatch[field] = value;
    }
  }
  if (Object.keys(measurementPatch).length === 0) return;

  const todayIso = new Date().toISOString().slice(0, 10);
  await adminDb
    .collection("users")
    .doc(uid)
    .collection("measurements")
    .doc(todayIso)
    .set(
      {
        ...measurementPatch,
        date: todayIso,
        source: "coach", // les updates via cette route viennent du COACH_SAVE
        updated_at: new Date().toISOString(),
      },
      { merge: true },
    );
}

/**
 * Convert flat dot-notation map to nested object so set({merge:true})
 * only patches the leaves without overwriting siblings.
 * Example: { "profile.height": 175, "profile.weight": 95 }
 *       => { profile: { height: 175, weight: 95 } }
 */
function buildNestedPayload(flat: Record<string, FieldValue>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [path, value] of Object.entries(flat)) {
    const parts = path.split(".");
    let cursor = out;
    for (let i = 0; i < parts.length - 1; i++) {
      const key = parts[i];
      if (typeof cursor[key] !== "object" || cursor[key] === null) {
        cursor[key] = {};
      }
      cursor = cursor[key] as Record<string, unknown>;
    }
    cursor[parts[parts.length - 1]] = value;
  }
  return out;
}
