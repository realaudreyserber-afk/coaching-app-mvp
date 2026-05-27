#!/usr/bin/env node
/**
 * scripts/show-last-session.mjs
 *
 * Pretty-print la dernière session de workout d'un user depuis Firestore.
 * Utile pour vérifier ce qui a été écrit par /api/sessions/log-full (pivot
 * vers le log post-séance, pattern Strong/Hevy/Jefit).
 *
 * Usage:
 *   $env:FIREBASE_PROJECT_ID="linsociable-coaching"
 *   node scripts/show-last-session.mjs --email=real.audrey.serber@gmail.com
 *   node scripts/show-last-session.mjs --uid=x4djKXyN... --limit=3
 *
 * Output: status, durée, volume, completion, top lift, sets logged par exo.
 * Lecture seule, pas d'écriture.
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
const LIMIT = parseInt(parseFlag("--limit=") ?? "1", 10) || 1;

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

function formatDurationSec(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}min ${s.toString().padStart(2, "0")}s`;
}

function formatSession(sess, idx, total) {
  divider(`🏋  SESSION ${idx + 1}/${total} — id: ${sess.id}`);
  console.log(`   session_code     : ${sess.session_code ?? "(absent)"}`);
  console.log(`   operation_name   : ${sess.operation_name ?? "(absent)"}`);
  console.log(`   session_type     : ${sess.session_type ?? "?"}`);
  console.log(`   status           : ${sess.status}`);
  console.log(`   plan_id          : ${sess.plan_id ?? "(absent)"}`);
  console.log(`   user_level       : ${sess.user_level_snapshot ?? "?"}`);
  console.log(`   started_at       : ${sess.started_at ?? "?"}`);
  console.log(`   finished_at      : ${sess.finished_at ?? "(non terminée)"}`);
  if (sess.aborted_reason) {
    console.log(`   aborted_reason   : ${sess.aborted_reason}`);
  }

  divider("📊 METRICS");
  const m = sess.metrics ?? {};
  console.log(`   duration         : ${formatDurationSec(m.duration_seconds ?? 0)}`);
  console.log(`   volume_kg        : ${m.volume_kg ?? 0} kg`);
  console.log(`   tonnage/set      : ${m.tonnage_avg_per_set_kg ?? 0} kg`);
  console.log(`   density          : ${m.density_sets_per_min ?? 0} sets/min`);
  console.log(`   calories est.    : ${m.calories_est_kcal ?? 0} kcal`);
  console.log(`   sets completed   : ${m.sets_completed ?? 0} / ${m.sets_planned ?? 0}`);
  console.log(`   completion       : ${m.completion_pct ?? 0}%`);
  if (m.vs_previous_volume_pct !== undefined) {
    console.log(`   vs precedent vol : ${m.vs_previous_volume_pct > 0 ? "+" : ""}${m.vs_previous_volume_pct}%`);
  }
  console.log(`   eau              : ${m.water_consumed_l ?? 0} / ${m.water_target_l ?? 0} L`);

  divider(`💪 EXERCICES (${(sess.exercises ?? []).length})`);
  (sess.exercises ?? []).forEach((ex, i) => {
    console.log("");
    console.log(`   [${i}] ${ex.exercise_name} (id: ${ex.exercise_id})`);
    console.log(`        block_code: ${ex.block_code} · load: ${ex.load_type}`);
    console.log(`        cible: ${ex.target_sets}×${ex.target_reps_range} · repos ${ex.rest_seconds}s · RPE cible ${ex.target_rpe}`);
    const sets = ex.sets_logged ?? [];
    if (sets.length === 0) {
      console.log(`        ⚠️  aucun set loggé`);
    } else {
      console.log(`        sets effectués (${sets.length}) :`);
      sets.forEach((s) => {
        const load = (s.weight_kg ?? 0) + (s.loaded_kg ?? 0);
        const e1rm = load > 0 ? Math.round(load * (1 + (s.reps_done ?? 0) / 30)) : 0;
        const notes = s.notes ? ` · "${s.notes}"` : "";
        const tempo = s.tempo_seconds !== undefined ? ` · tempo ${s.tempo_seconds}s` : "";
        const rest = s.rest_taken_seconds !== undefined ? ` · repos pris ${s.rest_taken_seconds}s` : "";
        console.log(
          `          #${s.set_index}: ${load}kg × ${s.reps_done} reps @ RPE ${s.rpe_felt} (e1RM ${e1rm}kg)${tempo}${rest}${notes}`,
        );
      });
    }
    if (ex.last_performance) {
      const lp = ex.last_performance;
      console.log(
        `        last_performance: ${lp.weight_kg}kg × ${lp.reps_done} reps @ RPE ${lp.rpe_felt} (il y a ${lp.days_ago}j)`,
      );
    }
    if (ex.notes) console.log(`        notes exo: ${ex.notes}`);
  });

  if (sess.user_notes) {
    divider("📝 USER NOTES");
    console.log(`   ${sess.user_notes}`);
  }

  if (sess.bio_snapshot) {
    divider("❤️  BIO SNAPSHOT");
    console.log(JSON.stringify(sess.bio_snapshot, null, 2));
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
  console.log(`   limit         : ${LIMIT}`);
  console.log("═════════════════════════════════════════════");
  console.log("");

  const sessionsRef = db.collection("users").doc(uid).collection("workout_sessions");
  const snap = await sessionsRef.orderBy("started_at", "desc").limit(LIMIT).get();
  if (snap.empty) {
    console.log("⚠️  Aucune workout_session pour ce user.");
    return;
  }

  snap.docs.forEach((doc, i) => {
    formatSession({ id: doc.id, ...doc.data() }, i, snap.size);
  });

  // Affiche aussi last_session_summary denormalisé sur le user doc
  const userSnap = await db.collection("users").doc(uid).get();
  const lss = userSnap.data()?.last_session_summary;
  if (lss) {
    console.log("");
    divider("📌 users/{uid}.last_session_summary (denormalisé pour dashboard + coach)");
    console.log(JSON.stringify(lss, null, 2));
  } else {
    console.log("");
    console.log("ℹ️  Pas de last_session_summary denormalisé sur le user doc.");
  }

  console.log("");
}

main().catch((err) => {
  console.error("💥 fatal:", err);
  process.exit(1);
});
