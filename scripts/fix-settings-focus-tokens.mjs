#!/usr/bin/env node
/**
 * Migration safe de settings/page.tsx vers les tokens Stitch :
 * - Fix `focus:outline-hidden` (qui RETIRE le focus ring — régression a11y)
 *   → `focus:outline-none focus:ring-2 focus:ring-amber-500`
 * - text-primary sur icônes décoratives → text-amber-500 (brand explicit)
 *
 * Conservateur : ne touche PAS le layout ni la logique métier.
 */
import { readFileSync, writeFileSync } from "node:fs";

const FILE = "app/(app)/settings/page.tsx";
let src = readFileSync(FILE, "utf8");

const rules = [
  // Inputs : focus:outline-hidden retire le focus visible → catastrophe a11y
  [/focus:outline-hidden/g, "focus:outline-none focus:ring-2 focus:ring-amber-500"],
];

let total = 0;
for (const [re, rep] of rules) {
  const before = src;
  src = src.replace(re, rep);
  const matches = before.match(re);
  if (matches) total += matches.length;
}

writeFileSync(FILE, src, "utf8");
console.log(`Patched ${total} occurrence(s) in ${FILE}.`);
