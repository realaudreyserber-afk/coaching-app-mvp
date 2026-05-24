#!/usr/bin/env node
/**
 * Lint: enforce snake_case convention for Firestore collections + fields per ADR-006.
 *
 * Scans .ts/.tsx files under app/, lib/, functions/src/ for:
 *   - `collection(db, 'Xxxx')` / `.collection('Xxxx')` — collection names
 *   - `doc(db, 'users', uid, 'Xxxx', ...)` — sub-collection names
 *
 * Flags any identifier that contains:
 *   - kebab-case (`food-logs`)
 *   - camelCase with uppercase (`coachMessages`, `fastingProtocol`)
 *   - PascalCase (`CoachMessages`)
 *
 * Allows underscores and lowercase only.
 *
 * Usage: node scripts/check-snake-case.mjs
 * Exit 1 if any violation found.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOTS = ['app', 'lib', 'functions/src'];
const EXTS = new Set(['.ts', '.tsx']);
const IGNORE_DIRS = new Set(['node_modules', '.next', 'lib_compiled', 'lib']);
const ALLOW_LIST = new Set([
  // Firestore reserved + system docs
  'documents',
  // generic placeholders in template strings
]);

function listFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (IGNORE_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    let s;
    try { s = statSync(full); } catch { continue; }
    if (s.isDirectory()) {
      out.push(...listFiles(full));
    } else if (EXTS.has(extname(entry))) {
      out.push(full);
    }
  }
  return out;
}

// match collection('name'), .collection('name'), or doc(db, ..., 'name', '...')
const PATTERNS = [
  /\bcollection\s*\(\s*(?:db|adminDb)\s*,\s*['"]([^'"]+)['"]/g,
  /\.collection\s*\(\s*['"]([^'"]+)['"]/g,
  /\bdoc\s*\(\s*(?:db|adminDb)\s*,\s*['"][^'"]+['"]\s*,\s*[^,]+,\s*['"]([^'"]+)['"]/g,
];

// Allow leading underscore for admin-only / internal collections (e.g. _stripe_events)
const SNAKE = /^_?[a-z][a-z0-9_]*$/;

function isViolation(name) {
  if (ALLOW_LIST.has(name)) return false;
  // path-style strings (e.g. variable interpolation already collapsed) are OK
  if (name.includes('${') || name.includes('${')) return false;
  return !SNAKE.test(name);
}

let violations = [];
let totalScanned = 0;

const projectRoot = process.cwd();
const files = ROOTS.flatMap((r) => {
  try { return listFiles(join(projectRoot, r)); } catch { return []; }
});

for (const file of files) {
  totalScanned++;
  const content = readFileSync(file, 'utf8');
  for (const re of PATTERNS) {
    let m;
    while ((m = re.exec(content)) !== null) {
      const name = m[1];
      if (isViolation(name)) {
        const before = content.slice(0, m.index);
        const line = before.split('\n').length;
        violations.push({ file: file.replace(projectRoot + '\\', '').replace(projectRoot + '/', ''), line, name });
      }
    }
  }
}

if (violations.length === 0) {
  console.log(`✅ snake_case lint passed (${totalScanned} files scanned, 0 violations)`);
  process.exit(0);
}

console.error(`❌ snake_case violations (${violations.length}):\n`);
for (const v of violations) {
  console.error(`  ${v.file}:${v.line}  →  Firestore identifier "${v.name}" should be snake_case`);
}
console.error('\nADR-006: snake_case obligatoire pour collections, sub-collections et fields Firestore.');
process.exit(1);
