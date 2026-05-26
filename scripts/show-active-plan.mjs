#!/usr/bin/env node
/**
 * scripts/show-active-plan.mjs
 *
 * Pretty-print the active plan of a user from Firestore, for comparison
 * against external programs (e.g. Fitadium) or to audit what the IA
 * actually generated.
 *
 * Usage:
 *   $env:FIREBASE_PROJECT_ID="linsociable-coaching"
 *   node scripts/show-active-plan.mjs --email=real.audrey.serber@gmail.com
 *   node scripts/show-active-plan.mjs --uid=x4djKXyNrXagBI6hMw74E34pHJy1
 *   node scripts/show-active-plan.mjs --email=... --include-history
 *
 * Output: console-formatted plan with sessions, exos (with sets×reps + repos),
 * macros, meals, supplements, justification. No write operations.
 */

import admin from "firebase-admin";

const PROJECT = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
if (!PROJECT) {
  console.error("❌ FIREBASE_PROJECT_ID env required");
  process.exit(1);
}

function parseFlag(prefix) {
  const arg = process.argv.find((a) => a.startsWith(prefix));
  if (!arg) return null;
  return arg.slice(prefix.length);
}

const EMAIL = parseFlag("--email=");
const UID_ARG = parseFlag("--uid=");
const INCLUDE_HISTORY = process.argv.includes("--include-history");

if (!EMAIL && !UID_ARG) {
  console.error("❌ pass either --email=... or --uid=...");
  process.exit(1);
}

admin.initializeApp({ projectId: PROJECT });
const auth = admin.auth();
const db = admin.firestore();

async function resolveUid() {
  if (UID_ARG) return UID_ARG;
  const u = await auth.getUserByEmail(EMAIL);
  return u.uid;
}

function divider(label) {
  console.log("─────────────────────────────────────────────");
  if (label) console.log(label);
}

function formatPlan(plan, label) {
  divider(`📋 ${label} — plan_id: ${plan.id}`);
  console.log(`   active        : ${plan.active}`);
  console.log(`   date_start    : ${plan.date_start ?? "?"}`);
  console.log(`   source        : ${plan.source ?? "?"}`);
  console.log(`   created_at    : ${plan.created_at ?? "?"}`);
  console.log(`   last_patched  : ${plan.last_patched_at ?? "never"}`);
  console.log("");

  divider("🍽  NUTRITION");
  console.log(`   Calories      : ${plan.kcal} kcal/jour`);
  if (plan.macros) {
    console.log(`   Macros        : ${plan.macros.p}g P / ${plan.macros.c}g C / ${plan.macros.f}g F`);
    const kcalFromMacros = plan.macros.p * 4 + plan.macros.c * 4 + plan.macros.f * 9;
    console.log(`   (check macros = ${kcalFromMacros} kcal — diff vs target: ${kcalFromMacros - plan.kcal})`);
  }
  if (Array.isArray(plan.meals_template)) {
    console.log(`   Meals (${plan.meals_template.length}):`);
    plan.meals_template.forEach((m, i) => {
      console.log(`     [${i}] ${m.name} · ${m.approx_kcal} kcal`);
      console.log(`         ${m.description}`);
    });
  }

  divider("🏋  TRAINING");
  if (plan.training?.sessions?.length) {
    console.log(`   Sessions (${plan.training.sessions.length}):`);
    plan.training.sessions.forEach((s, i) => {
      console.log("");
      console.log(`   ─ training.sessions.${i}: "${s.name}" · ${s.frequency_weekly}×/sem · ${s.exercises?.length ?? 0} exos`);
      if (Array.isArray(s.exercises)) {
        s.exercises.forEach((e, j) => {
          const supersetTag = e.superset_group ? ` · [superset ${e.superset_group}]` : "";
          console.log(`     [${j}] ${e.name} · ${e.sets}×${e.reps} · repos ${e.rest_seconds}s${supersetTag}`);
        });
      }
    });
  } else {
    console.log("   (no training sessions in this plan)");
  }

  divider("🏃  CARDIO");
  if (plan.cardio) {
    console.log(`   Type          : ${plan.cardio.type}`);
    console.log(`   Duration      : ${plan.cardio.duration_minutes} min`);
    console.log(`   Frequency     : ${plan.cardio.frequency_weekly}×/sem`);
    console.log(`   Intensity     : ${plan.cardio.intensity}`);
  } else {
    console.log("   (no cardio block)");
  }

  if (Array.isArray(plan.supplements) && plan.supplements.length) {
    divider(`💊 SUPPLEMENTS (${plan.supplements.length})`);
    plan.supplements.forEach((s) => {
      console.log(`   - ${s.name} · ${s.dosage} · ${s.timing}`);
    });
  }

  if (plan.justification) {
    divider("🧠 JUSTIFICATION");
    console.log(plan.justification);
  }

  if (plan.lifestyle_notes) {
    divider("🌙 LIFESTYLE NOTES");
    console.log(plan.lifestyle_notes);
  }
}

async function main() {
  const uid = await resolveUid();
  console.log("");
  console.log("═════════════════════════════════════════════");
  console.log(`👤 User`);
  console.log(`   project       : ${PROJECT}`);
  console.log(`   email         : ${EMAIL ?? "(uid only)"}`);
  console.log(`   uid           : ${uid}`);
  console.log("═════════════════════════════════════════════");
  console.log("");

  const plansRef = db.collection("users").doc(uid).collection("plans");
  const activeSnap = await plansRef.where("active", "==", true).limit(1).get();
  if (activeSnap.empty) {
    console.log("⚠️  No active plan for this user.");
    return;
  }
  const activeDoc = activeSnap.docs[0];
  formatPlan({ id: activeDoc.id, ...activeDoc.data() }, "ACTIVE PLAN");

  if (INCLUDE_HISTORY) {
    const allSnap = await plansRef.orderBy("created_at", "desc").get();
    const archived = allSnap.docs.filter((d) => d.id !== activeDoc.id);
    if (archived.length > 0) {
      console.log("");
      divider(`📚 ARCHIVED PLANS (${archived.length})`);
      archived.forEach((d) => {
        const p = d.data();
        console.log(
          `   - plan_id: ${d.id} · ${p.created_at} · ${p.kcal} kcal · source=${p.source ?? "?"}`,
        );
      });
    }
  }

  console.log("");
}

main().catch((err) => {
  console.error("💥 fatal:", err);
  process.exit(1);
});
