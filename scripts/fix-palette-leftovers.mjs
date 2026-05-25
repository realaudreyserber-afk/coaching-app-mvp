#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

// Files to scan: every .tsx in app + components
const files = execSync(
  'git ls-files "app/**/*.tsx" "components/**/*.tsx"',
  { encoding: "utf8" }
)
  .trim()
  .split(/\r?\n/)
  .filter(Boolean);

// Replacements (order matters — more specific first)
const rules = [
  // Wrappers
  [/bg-cream px-4 dark:bg-anthracite/g, "bg-background px-4"],
  [/bg-cream dark:bg-anthracite\b(?!\/)/g, "bg-background"],
  [/bg-cream\/(\d+) dark:bg-anthracite\/(\d+)/g, "bg-muted"],
  [/bg-cream dark:bg-anthracite\/(\d+)/g, "bg-muted"],

  // White-on-dark cards
  [/bg-white\/(\d+) dark:bg-black\/(\d+)/g, "bg-card/$1"],
  [/bg-white dark:bg-black\/(\d+)/g, "bg-card"],
  [/bg-white\/(\d+) dark:bg-anthracite\/(\d+)/g, "bg-card/$1"],
  [/bg-white dark:bg-anthracite\b(?!\/)/g, "bg-card"],
];

let touched = 0;
let totalReplacements = 0;

for (const f of files) {
  let src;
  try {
    src = readFileSync(f, "utf8");
  } catch {
    continue;
  }
  let modified = src;
  let count = 0;
  for (const [re, rep] of rules) {
    const before = modified;
    modified = modified.replace(re, rep);
    if (before !== modified) {
      const matches = before.match(re);
      count += matches ? matches.length : 0;
    }
  }
  if (modified !== src) {
    writeFileSync(f, modified, "utf8");
    touched++;
    totalReplacements += count;
    console.log(`  ✓ ${f} — ${count} replacement(s)`);
  }
}

console.log(`\nDone — ${touched} file(s), ${totalReplacements} replacement(s).`);
