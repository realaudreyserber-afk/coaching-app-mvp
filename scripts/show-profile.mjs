#!/usr/bin/env node
/**
 * scripts/show-profile.mjs
 *
 * Pretty-print les fields users/{uid}.profile + users/{uid}.baseline +
 * users/{uid}.goals pour vérifier rapidement ce qui est persisté en
 * Firestore. Utile pour auditer après une conv coach qui a émis des
 * <COACH_SAVE>.
 *
 * Usage:
 *   $env:FIREBASE_PROJECT_ID="linsociable-coaching"
 *   node scripts/show-profile.mjs --email=real.audrey.serber@gmail.com
 *
 * Lecture seule.
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

function row(label, value) {
  const display =
    value === undefined || value === null || value === ""
      ? "(absent)"
      : Array.isArray(value)
        ? `[${value.join(", ")}]`
        : typeof value === "object"
          ? JSON.stringify(value)
          : String(value);
  console.log(`   ${label.padEnd(28)} ${display}`);
}

async function main() {
  const uid = await resolveUid();
  console.log("");
  console.log("═════════════════════════════════════════════");
  console.log("👤 User");
  console.log(`   project        : ${PROJECT}`);
  console.log(`   email          : ${EMAIL ?? "(uid only)"}`);
  console.log(`   uid            : ${uid}`);
  console.log("═════════════════════════════════════════════");
  console.log("");

  const userRef = db.collection("users").doc(uid);
  const snap = await userRef.get();
  if (!snap.exists) {
    console.log("⚠️  Aucun doc user pour cet uid.");
    return;
  }
  const data = snap.data() ?? {};
  const p = data.profile ?? {};
  const b = data.baseline ?? {};
  const g = data.goals ?? {};

  console.log("─── PROFILE ─────────────────────────────────");
  row("name", p.name);
  row("age / dob", `${p.age ?? "?"} / ${p.dob ?? "?"}`);
  row("sex", p.sex);
  row("height (cm)", p.height);
  row("weight (kg)", p.weight);
  row("activity_level", p.activity_level);
  row("training_frequency", p.training_frequency);
  row("training_history", p.training_history);
  row("training_environment", p.training_environment);
  row("available_equipment", p.available_equipment);
  row("timezone", p.timezone);
  console.log("   ── Mensurations ──");
  row("waist_cm", p.waist_cm);
  row("neck_cm", p.neck_cm);
  row("hips_cm", p.hips_cm);
  row("shoulder_cm", p.shoulder_cm);
  row("chest_cm", p.chest_cm);
  row("arm_cm", p.arm_cm);
  row("forearm_cm", p.forearm_cm);
  row("wrist_cm", p.wrist_cm);
  row("thigh_cm", p.thigh_cm);
  row("calf_cm", p.calf_cm);
  console.log("   ── BF / hormonal ──");
  row("bf_method", p.bf_method);
  row("hormonal_context", p.hormonal_context);
  row("medical_notes", p.medical_notes);
  row("tdee_theoretical", p.tdee_theoretical);
  row("tdee_adaptive", p.tdee_adaptive);

  console.log("");
  console.log("─── BASELINE ────────────────────────────────");
  row("weight (kg)", b.weight);
  row("bf_pct", b.bf_pct);
  row("bf_measured_at", b.bf_measured_at);

  console.log("");
  console.log("─── GOALS ───────────────────────────────────");
  row("primary_goal", g.primary_goal);
  row("type", g.type);
  row("target_weight", g.target_weight);
  row("target_bf_pct", g.target_bf_pct);
  row("deadline", g.deadline);

  console.log("");
  console.log("─── META ────────────────────────────────────");
  row("onboarding_step", data.onboarding_step);
  row("onboarding_completed", data.onboarding_completed);
  row("plan_current_id", data.plan_current_id);
  row("profile_path", data.profile_path);
  row("subscription.tier", data.subscription?.tier);

  console.log("");
}

main().catch((err) => {
  console.error("💥 fatal:", err);
  process.exit(1);
});
