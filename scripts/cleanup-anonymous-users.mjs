#!/usr/bin/env node
/**
 * scripts/cleanup-anonymous-users.mjs
 *
 * Removes anonymous Firebase Auth users + their Firestore data when they
 * have either no profile at all (default) or an unfinished onboarding
 * (--include-incomplete).
 *
 * Background: the app calls `signInAnonymously()` on every visit (see
 * components/auth/auth-provider.tsx:166) and creates a users/{uid} doc as
 * soon as /onboarding renders (app/(app)/onboarding/page.tsx:41). After a
 * few weeks of public traffic that produces hundreds of empty user docs.
 *
 * Safety:
 *  - Dry-run by default. Nothing is deleted unless --confirm is passed.
 *  - Users with `onboarding_completed: true` are NEVER touched, regardless
 *    of flags — that's a real customer.
 *  - Users with a non-anonymous provider (google, password, etc.) are
 *    NEVER touched — even if their Firestore doc looks empty.
 *
 * Usage:
 *   # 1. List candidates (no deletion)
 *   node scripts/cleanup-anonymous-users.mjs
 *
 *   # 2. Same, but also list users who started onboarding but didn't finish
 *   node scripts/cleanup-anonymous-users.mjs --include-incomplete
 *
 *   # 3. Actually delete
 *   node scripts/cleanup-anonymous-users.mjs --confirm
 *
 *   # 4. Delete EVERYTHING anonymous (no-data + incomplete)
 *   node scripts/cleanup-anonymous-users.mjs --include-incomplete --confirm
 *
 *   # 5. Always keep the N most recent anonymous users (paranoid safety)
 *   node scripts/cleanup-anonymous-users.mjs --keep-most-recent=1 --confirm
 *
 *   # 6. Force-delete specific UIDs (bypasses ALL filters — use after auditing)
 *   node scripts/cleanup-anonymous-users.mjs --uids=UID1,UID2,UID3 --confirm
 *
 * Requires:
 *   - GOOGLE_APPLICATION_CREDENTIALS env var pointing to a service account
 *     JSON, OR gcloud auth application-default login active.
 *   - Service account role: Firebase Authentication Admin + Cloud Datastore User
 *     (or just project Owner / Editor).
 *
 * Env vars:
 *   - FIREBASE_PROJECT_ID (required, no default — fail fast on wrong project)
 */

import admin from "firebase-admin";

const PROJECT = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
if (!PROJECT) {
  console.error("❌ FIREBASE_PROJECT_ID (or GOOGLE_CLOUD_PROJECT) env required");
  console.error("   Set it explicitly to avoid wiping the wrong project:");
  console.error('   $env:FIREBASE_PROJECT_ID="linsociable-coaching"');
  process.exit(1);
}

const CONFIRM = process.argv.includes("--confirm");
const INCLUDE_INCOMPLETE = process.argv.includes("--include-incomplete");

// --keep-most-recent=N : never delete the N most recently created anonymous
// users, even if they match other deletion criteria. Defensive guard for
// "I just signed in anonymously and I want to keep that session".
function parseKeepMostRecent() {
  const arg = process.argv.find((a) => a.startsWith("--keep-most-recent"));
  if (!arg) return 0;
  const eq = arg.indexOf("=");
  if (eq === -1) return 1; // bare flag means "keep 1"
  const n = parseInt(arg.slice(eq + 1), 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}
const KEEP_MOST_RECENT = parseKeepMostRecent();

// --uids=UID1,UID2,UID3 : force-delete specific UIDs without going through
// the classification pipeline. Use after manually auditing the Auth console.
// Bypasses anonymous-only filter, onboarding_completed protection, and
// keep-most-recent. Operator is responsible for not deleting their own user.
function parseUidsList() {
  const arg = process.argv.find((a) => a.startsWith("--uids="));
  if (!arg) return null;
  const list = arg
    .slice("--uids=".length)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length > 0 ? list : null;
}
const FORCE_UIDS = parseUidsList();

console.log("🧹 Anonymous users cleanup");
console.log(`   project           : ${PROJECT}`);
console.log(`   mode              : ${CONFIRM ? "DELETE (confirmed)" : "DRY-RUN"}`);
if (FORCE_UIDS) {
  console.log(`   selection         : FORCE-DELETE (${FORCE_UIDS.length} explicit UIDs, bypasses all filters)`);
} else {
  console.log(
    `   selection         : ${INCLUDE_INCOMPLETE ? "anonymous + (no-profile OR profile-but-no-onboarding_completed)" : "anonymous + no-profile only"}`,
  );
  console.log(`   keep-most-recent  : ${KEEP_MOST_RECENT}`);
}
console.log("");

admin.initializeApp({ projectId: PROJECT });
const auth = admin.auth();
const db = admin.firestore();

/**
 * Page through ALL Auth users (1000 per page). Returns a flat array of
 * { uid, providerData, creationTime } for those with an empty providerData
 * (= anonymous).
 */
async function listAnonymousAuthUsers() {
  const anonymous = [];
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    for (const u of page.users) {
      if (!u.providerData || u.providerData.length === 0) {
        anonymous.push({
          uid: u.uid,
          creationTime: u.metadata.creationTime,
          lastSignInTime: u.metadata.lastSignInTime,
        });
      }
    }
    pageToken = page.pageToken;
  } while (pageToken);
  return anonymous;
}

/**
 * For each anonymous Auth user, check the Firestore doc and classify:
 *   - 'keep_completed'  : onboarding_completed === true (real customer, NEVER delete)
 *   - 'keep_real_email' : doc.email is a real address (shouldn't happen for anonymous, but defensive)
 *   - 'candidate_empty' : no profile at all → safe to delete in default mode
 *   - 'candidate_partial' : profile exists but onboarding_completed !== true → deleted only with --include-incomplete
 *   - 'no_firestore_doc' : Auth user exists but no Firestore presence → safe to delete (Auth-only orphan)
 */
async function classify(anonymousAuthUsers) {
  const buckets = {
    keep_completed: [],
    keep_real_email: [],
    candidate_empty: [],
    candidate_partial: [],
    no_firestore_doc: [],
  };

  // Batch by 50 to keep memory reasonable
  const BATCH = 50;
  for (let i = 0; i < anonymousAuthUsers.length; i += BATCH) {
    const batch = anonymousAuthUsers.slice(i, i + BATCH);
    const docs = await Promise.all(
      batch.map((u) => db.collection("users").doc(u.uid).get()),
    );
    for (let j = 0; j < batch.length; j++) {
      const u = batch[j];
      const snap = docs[j];
      if (!snap.exists) {
        buckets.no_firestore_doc.push(u);
        continue;
      }
      const data = snap.data() || {};
      if (data.onboarding_completed === true) {
        buckets.keep_completed.push({ ...u, doc: data });
        continue;
      }
      if (
        typeof data.email === "string" &&
        data.email.length > 0 &&
        !data.email.endsWith("@anonymous.local")
      ) {
        buckets.keep_real_email.push({ ...u, doc: data });
        continue;
      }
      if (data.profile === undefined) {
        buckets.candidate_empty.push({ ...u, doc: data });
      } else {
        buckets.candidate_partial.push({ ...u, doc: data });
      }
    }
    process.stdout.write(`  ↳ classified ${Math.min(i + BATCH, anonymousAuthUsers.length)}/${anonymousAuthUsers.length}\r`);
  }
  process.stdout.write("\n");
  return buckets;
}

/**
 * Recursive delete of a Firestore doc + all its sub-collections.
 * firebase-admin v11+ exposes `firestore.recursiveDelete(ref)` for this.
 */
async function nukeFirestoreUser(uid) {
  const ref = db.collection("users").doc(uid);
  await db.recursiveDelete(ref);
}

async function nukeAuthUser(uid) {
  await auth.deleteUser(uid);
}

async function runForceUids(uids) {
  console.log(`🎯 Force-delete mode — ${uids.length} UID(s) explicitly provided.`);
  console.log(`   These will be deleted regardless of provider, onboarding, or recency.`);
  console.log("");
  if (!CONFIRM) {
    console.log("🟡 DRY-RUN — no deletion performed. UIDs that would be deleted:");
    for (const uid of uids) console.log(`   ${uid}`);
    console.log("");
    console.log("Re-run with --confirm to actually delete.");
    return;
  }
  console.log("⚠️  DELETING NOW. No undo.");
  console.log("");
  let okFs = 0;
  let okAuth = 0;
  let fail = 0;
  for (const uid of uids) {
    try {
      await nukeFirestoreUser(uid);
      okFs += 1;
    } catch (err) {
      console.error(`  ✗ Firestore ${uid}: ${err?.message ?? err}`);
      fail += 1;
      continue;
    }
    try {
      await nukeAuthUser(uid);
      okAuth += 1;
    } catch (err) {
      const msg = err?.code === "auth/user-not-found" ? "(already gone)" : (err?.message ?? err);
      console.error(`  ~ Auth ${uid}: ${msg}`);
    }
  }
  console.log("");
  console.log(`✅ Done. Firestore: ${okFs}/${uids.length} · Auth: ${okAuth}/${uids.length} · Errors: ${fail}`);
}

async function main() {
  // Force-delete path: short-circuit the classification pipeline.
  if (FORCE_UIDS) {
    await runForceUids(FORCE_UIDS);
    return;
  }

  console.log("📋 Listing anonymous Auth users (pages of 1000)...");
  const anonymous = await listAnonymousAuthUsers();
  console.log(`  → ${anonymous.length} anonymous Auth user(s) total`);
  console.log("");

  if (anonymous.length === 0) {
    console.log("✅ Nothing to do, exiting.");
    return;
  }

  console.log("🔍 Classifying against Firestore docs...");
  const buckets = await classify(anonymous);
  console.log("");
  console.log("📊 Classification:");
  console.log(`  - keep_completed     : ${buckets.keep_completed.length}  (real customers, NEVER touched)`);
  console.log(`  - keep_real_email    : ${buckets.keep_real_email.length}  (anonymous Auth but real email in doc — defensive keep)`);
  console.log(`  - candidate_empty    : ${buckets.candidate_empty.length}  (no profile — default delete)`);
  console.log(`  - candidate_partial  : ${buckets.candidate_partial.length}  (profile exists, no onboarding_completed — needs --include-incomplete)`);
  console.log(`  - no_firestore_doc   : ${buckets.no_firestore_doc.length}  (Auth-only orphan — default delete)`);
  console.log("");

  let toDelete = [
    ...buckets.candidate_empty,
    ...buckets.no_firestore_doc,
    ...(INCLUDE_INCOMPLETE ? buckets.candidate_partial : []),
  ];

  if (KEEP_MOST_RECENT > 0 && toDelete.length > 0) {
    // Sort the candidate pool by creationTime desc, lift the N most recent
    // out of the deletion list. Auth metadata.creationTime is an ISO string,
    // so lex-sort works.
    const sortedByRecent = [...toDelete].sort((a, b) =>
      String(b.creationTime).localeCompare(String(a.creationTime)),
    );
    const kept = sortedByRecent.slice(0, KEEP_MOST_RECENT);
    const keptUids = new Set(kept.map((u) => u.uid));
    toDelete = toDelete.filter((u) => !keptUids.has(u.uid));
    console.log(`🛡  Keeping ${kept.length} most recent anonymous user(s) (--keep-most-recent):`);
    for (const k of kept) {
      console.log(`     ${k.uid}  (created ${k.creationTime})`);
    }
    console.log("");
  }

  if (toDelete.length === 0) {
    console.log("✅ Nothing to delete with current flags.");
    return;
  }

  console.log(`🎯 Deletion target: ${toDelete.length} user(s).`);

  if (!CONFIRM) {
    console.log("");
    console.log("🟡 DRY-RUN — no deletion performed. First 10 UIDs that would be deleted:");
    for (const u of toDelete.slice(0, 10)) {
      console.log(`   ${u.uid}  (created ${u.creationTime}, last seen ${u.lastSignInTime})`);
    }
    if (toDelete.length > 10) {
      console.log(`   ... + ${toDelete.length - 10} more`);
    }
    console.log("");
    console.log("Re-run with --confirm to actually delete.");
    return;
  }

  console.log("");
  console.log("⚠️  DELETING NOW. No undo.");
  console.log("");

  let okFs = 0;
  let okAuth = 0;
  let fail = 0;
  for (let i = 0; i < toDelete.length; i++) {
    const u = toDelete[i];
    try {
      await nukeFirestoreUser(u.uid);
      okFs += 1;
    } catch (err) {
      console.error(`  ✗ Firestore ${u.uid}: ${err?.message ?? err}`);
      fail += 1;
      // Don't continue to Auth delete if Firestore failed — keeps the pair consistent
      continue;
    }
    try {
      await nukeAuthUser(u.uid);
      okAuth += 1;
    } catch (err) {
      // Auth user may already be gone — log but don't count as fatal
      const msg = err?.code === "auth/user-not-found" ? "(already gone)" : (err?.message ?? err);
      console.error(`  ~ Auth ${u.uid}: ${msg}`);
    }
    if ((i + 1) % 25 === 0) {
      process.stdout.write(`  ↳ deleted ${i + 1}/${toDelete.length}\r`);
    }
  }
  process.stdout.write("\n");
  console.log("");
  console.log(`✅ Done. Firestore: ${okFs}/${toDelete.length} · Auth: ${okAuth}/${toDelete.length} · Errors: ${fail}`);
}

main().catch((err) => {
  console.error("💥 fatal:", err);
  process.exit(1);
});
