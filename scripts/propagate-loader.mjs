#!/usr/bin/env node
/**
 * Replace legacy inline loaders with <Loader size="fullscreen" message={...} />.
 * Targets the pattern :
 *
 *   <div className="...bg-background...">
 *     <div className="text-center space-y-4">
 *       <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
 *       <p className="text-sm text-muted-foreground font-serif">MESSAGE</p>
 *     </div>
 *   </div>
 *
 * Adds the import on the fly.
 */
import { readFileSync, writeFileSync } from "node:fs";

const FILES = [
  "app/(app)/layout.tsx",
  "app/(auth)/login/page.tsx",
  "app/(auth)/callback/page.tsx",
  "app/(app)/settings/page.tsx",
  "app/(app)/progress/page.tsx",
  "app/(app)/onboarding/page.tsx",
  "app/(app)/plan/page.tsx",
  "app/(app)/onboarding/[step]/page.tsx",
];

// Regex captures the wrapper div + nested spinner div + p tag.
// Tolerant of variations in the message (whitespace, braces, escaping).
const LOADER_RE =
  /<div className="[^"]*items-center justify-center bg-background[^"]*">\s*<div className="text-center space-y-4">\s*<div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" \/>\s*<p className="text-sm text-muted-foreground font-serif">([\s\S]*?)<\/p>\s*<\/div>\s*<\/div>/g;

let totalPatched = 0;

for (const file of FILES) {
  let src;
  try {
    src = readFileSync(file, "utf8");
  } catch {
    console.log(`  ✗ ${file} — not readable`);
    continue;
  }

  let count = 0;
  src = src.replace(LOADER_RE, (full, message) => {
    count++;
    // Clean up the message — it might be wrapped in {"..."} or {'...'}
    let cleanedMsg = message.trim();
    // If it's a single JSX expression like {"text"} or {'text'}, extract the string
    const stringMatch = cleanedMsg.match(/^\{["'](.+)["']\}$/s);
    if (stringMatch) {
      cleanedMsg = stringMatch[1];
    }
    return `<Loader size="fullscreen" message=${
      cleanedMsg.includes('"') ? `{${JSON.stringify(cleanedMsg)}}` : `"${cleanedMsg}"`
    } />`;
  });

  if (count === 0) {
    console.log(`  - ${file} — no pattern match`);
    continue;
  }

  // Add the import if not present
  if (!src.includes('@/components/ui/loader')) {
    // Find the last import line and insert after it
    const importMatch = src.match(/(import[\s\S]+?from\s+["'][^"']+["'];?\n)(?![\s\S]*?import[\s\S]+?from)/);
    if (importMatch) {
      const insertPos = importMatch.index + importMatch[0].length;
      src =
        src.slice(0, insertPos) +
        'import { Loader } from "@/components/ui/loader";\n' +
        src.slice(insertPos);
    } else {
      // Fallback: prepend at top
      src = 'import { Loader } from "@/components/ui/loader";\n' + src;
    }
  }

  writeFileSync(file, src, "utf8");
  totalPatched += count;
  console.log(`  ✓ ${file} — ${count} loader(s) replaced`);
}

console.log(`\nDone — ${totalPatched} loader(s) replaced across ${FILES.length} files.`);
