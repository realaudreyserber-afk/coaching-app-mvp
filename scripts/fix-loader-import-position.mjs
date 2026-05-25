#!/usr/bin/env node
/**
 * Fix : propagate-loader.mjs put `import { Loader } from "@/components/ui/loader";`
 * BEFORE the "use client" directive in client components. Next.js requires
 * "use client" to be on the first non-comment line of the file. Move the import
 * to its proper place (after "use client" and grouped with other imports).
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

const LOADER_IMPORT = 'import { Loader } from "@/components/ui/loader";';

for (const file of FILES) {
  let src;
  try {
    src = readFileSync(file, "utf8");
  } catch {
    continue;
  }

  // Skip if no misplaced import
  if (!src.startsWith(LOADER_IMPORT)) {
    console.log(`  - ${file} — already OK`);
    continue;
  }

  // Remove the misplaced import (with trailing newline)
  src = src.slice(LOADER_IMPORT.length).replace(/^\n/, "");

  // Find the "use client" directive
  const useClientRe = /(['"]use client['"];?\n)/;
  const match = src.match(useClientRe);

  if (!match) {
    // Server component — put import at top of imports block
    const firstImportRe = /^(import\s+)/m;
    const importMatch = src.match(firstImportRe);
    if (importMatch) {
      src =
        src.slice(0, importMatch.index) +
        LOADER_IMPORT +
        "\n" +
        src.slice(importMatch.index);
    } else {
      src = LOADER_IMPORT + "\n" + src;
    }
  } else {
    // Client component — insert AFTER "use client" + after the imports block
    const afterUseClient = match.index + match[0].length;
    // Find where the imports block ends (last consecutive import line)
    const restAfterDirective = src.slice(afterUseClient);
    const lastImportRe = /(import[\s\S]+?from\s+["'][^"']+["'];?\n)(?![\s\S]*?import[\s\S]+?from)/;
    const lastImportMatch = restAfterDirective.match(lastImportRe);
    if (lastImportMatch && lastImportMatch.index !== undefined) {
      const insertPos = afterUseClient + lastImportMatch.index + lastImportMatch[0].length;
      src = src.slice(0, insertPos) + LOADER_IMPORT + "\n" + src.slice(insertPos);
    } else {
      // No other imports — put right after "use client" + blank line
      src = src.slice(0, afterUseClient) + "\n" + LOADER_IMPORT + "\n" + src.slice(afterUseClient);
    }
  }

  writeFileSync(file, src, "utf8");
  console.log(`  ✓ ${file} — import repositioned`);
}
