// Read a user document from Firestore.
// Usage: node scripts/read-user.mjs <UID>

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

const uid = process.argv[2];
if (!uid) {
  console.error("Usage: node scripts/read-user.mjs <UID>");
  process.exit(1);
}

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
let privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
if (!projectId || !clientEmail || !privateKey) {
  console.error("Missing Firebase Admin env vars in .env.local");
  process.exit(1);
}
privateKey = privateKey.replace(/\\n/g, "\n");

if (!getApps().length) {
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

const db = getFirestore();
const ref = db.collection("users").doc(uid);
const snap = await ref.get();

if (!snap.exists) {
  console.log(`User ${uid} not found.`);
  process.exit(0);
}

const data = snap.data();
console.log("\n=== users/" + uid + " ===\n");
console.log(JSON.stringify(data, null, 2));

// Quick sub-collection peek
for (const sub of ["plans", "plans_history", "coach_messages"]) {
  try {
    const subSnap = await ref.collection(sub).limit(3).get();
    if (!subSnap.empty) {
      console.log(`\n--- ${sub} (top ${subSnap.size}) ---`);
      subSnap.forEach((d) => {
        console.log(`  ${d.id}:`, JSON.stringify(d.data()).slice(0, 200));
      });
    }
  } catch {
    // best-effort
  }
}
