#!/usr/bin/env node
/**
 * scripts/backup-user-data.mjs
 *
 * Dump complet des données Firestore d'un utilisateur sur disque local.
 * Inclut la nouvelle collection `agent_memory_backup` du Multi-Agent System.
 *
 * Usage:
 *   $env:FIREBASE_PROJECT_ID="linsociable-coaching"
 *   node scripts/backup-user-data.mjs --email=real.audrey.serber@gmail.com
 *   node scripts/backup-user-data.mjs --uid=x4djKXyNrXagBI6hMw74E34pHJy1
 *
 * Output : ./backups/{uid}/{YYYY-MM-DD-HHMMSS}/
 *   - profile.json             (doc users/{uid})
 *   - meta.json                (timestamp, env, schema)
 *   - <collection>.json        (chaque subcollection, array de docs avec id)
 *   - agent_memory_backup/*.json (1 file par session si verbose)
 *
 * EXCLUSIONS volontaires :
 *   - tokens/        (OAuth refresh tokens — secrets en clair sur disque = NON)
 *
 * Read-only. Aucune écriture Firestore.
 */

import admin from "firebase-admin";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

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
const OUT_BASE = parseFlag("--out=") || "./backups";
const VERBOSE_SESSIONS = process.argv.includes("--verbose-sessions");

if (!EMAIL && !UID_ARG) {
  console.error("❌ pass either --email=... or --uid=...");
  console.error("   optional: --out=./custom-dir  --verbose-sessions");
  process.exit(1);
}

admin.initializeApp({ projectId: PROJECT });
const auth = admin.auth();
const db = admin.firestore();

// Subcollections à dumper. Ordre = ordre d'écriture sur disque.
const SUBCOLLECTIONS = [
  "agent_memory_backup", // multi-agent
  "plans",
  "plans_history",
  "workout_sessions",
  "coach_messages",
  "food_logs",
  "checkins_daily",
  "checkins_weekly",
  "body_scans",
  "form_checks",
  "wearable_sync",
  "bloodwork",
  "coach_state",
  "coach_patches",
  "tdee_history",
  "session_debriefs",
  "insights_daily",
  "daily_tasks",
  "alerts",
  "medications",
  "photos",
  "cycles", // Phase 1 data-layer roadmap — cycle menstruel
  "cycle_settings", // Phase 1 data-layer roadmap — config cycle
  "measurements", // Phase 2 data-layer roadmap — mensurations time-series
  "prs", // Phase 3 data-layer roadmap — personal records par exo
  // Retirées (n'existent pas comme collections, calculées) :
  // streak (computed depuis checkins_daily.date)
  // micronutrients_daily (agrégé depuis food_logs)
  // notification_log (introuvable dans le code)
  // referrals (introuvable dans le code)
];

// EXCLUSIONS volontaires (cf. doc en tête)
const EXCLUDED = new Set(["tokens"]);

async function resolveUid() {
  if (UID_ARG) return UID_ARG;
  const u = await auth.getUserByEmail(EMAIL);
  return u.uid;
}

function timestampSlug() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

/** Stringify avec gestion des Firestore Timestamps. */
function stringify(value) {
  return JSON.stringify(
    value,
    (_key, val) => {
      if (val && typeof val === "object" && typeof val.toDate === "function") {
        // Firestore Timestamp → ISO string
        return val.toDate().toISOString();
      }
      return val;
    },
    2,
  );
}

async function dumpProfile(userRef, outDir) {
  const snap = await userRef.get();
  if (!snap.exists) {
    console.warn("⚠️  Profile doc users/{uid} doesn't exist — empty backup");
    writeFileSync(join(outDir, "profile.json"), "{}\n");
    return;
  }
  writeFileSync(join(outDir, "profile.json"), stringify(snap.data()) + "\n");
  console.log("  ✓ profile.json");
}

async function dumpSubcollection(userRef, name, outDir) {
  try {
    const snap = await userRef.collection(name).get();
    if (snap.empty) {
      console.log(`  ∅ ${name} (empty)`);
      return { count: 0 };
    }
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    writeFileSync(join(outDir, `${name}.json`), stringify(docs) + "\n");
    console.log(`  ✓ ${name}.json (${docs.length} doc${docs.length > 1 ? "s" : ""})`);

    // Pour agent_memory_backup en mode verbose : 1 fichier par session
    if (name === "agent_memory_backup" && VERBOSE_SESSIONS && docs.length > 0) {
      const sessDir = join(outDir, "agent_memory_backup");
      mkdirSync(sessDir, { recursive: true });
      docs.forEach((d) => {
        writeFileSync(join(sessDir, `${d.id}.json`), stringify(d) + "\n");
      });
      console.log(`    ↳ verbose: ${docs.length} session file(s) in ${name}/`);
    }
    return { count: docs.length };
  } catch (err) {
    console.error(`  ❌ ${name} FAILED:`, err.message);
    return { count: 0, error: err.message };
  }
}

async function main() {
  console.log(`🔵 Project: ${PROJECT}`);
  const uid = await resolveUid();
  console.log(`🔵 UID: ${uid}`);

  const stamp = timestampSlug();
  const outDir = join(OUT_BASE, uid, stamp);
  mkdirSync(outDir, { recursive: true });
  console.log(`🔵 Output dir: ${outDir}`);
  console.log("");

  const userRef = db.collection("users").doc(uid);

  // 1. Profile
  await dumpProfile(userRef, outDir);

  // 2. Subcollections
  const stats = {};
  for (const name of SUBCOLLECTIONS) {
    if (EXCLUDED.has(name)) {
      console.log(`  ⊘ ${name} (excluded — sensitive data)`);
      continue;
    }
    const result = await dumpSubcollection(userRef, name, outDir);
    stats[name] = result;
  }

  // 3. Meta
  const totalDocs = Object.values(stats).reduce((s, v) => s + (v.count || 0), 0);
  const meta = {
    backup_timestamp: new Date().toISOString(),
    firebase_project: PROJECT,
    uid,
    email: EMAIL || null,
    subcollections_attempted: SUBCOLLECTIONS,
    subcollections_excluded: Array.from(EXCLUDED),
    stats,
    total_docs_dumped: totalDocs,
    script_version: 1,
    schema_note:
      "agent_memory_backup belongs to the Multi-Agent System (cf. lib/vertex/agents/). schema_version field inside each session record.",
  };
  writeFileSync(join(outDir, "meta.json"), stringify(meta) + "\n");
  console.log("  ✓ meta.json");

  console.log("");
  console.log(`✅ Backup complete: ${totalDocs} total docs dumped`);
  console.log(`   → ${outDir}`);
}

main().catch((err) => {
  console.error("❌ Fatal:", err);
  process.exit(1);
});
