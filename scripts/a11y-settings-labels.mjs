#!/usr/bin/env node
/**
 * Adds htmlFor/id pairs to every <label className="...">Text</label>
 * immediately followed by an <input/<select element in a target JSX file.
 *
 * Slug strategy: kebab-case of the label text, prefixed with "settings-".
 * Skips labels that already have htmlFor.
 */
import { readFileSync, writeFileSync } from "node:fs";

const FILE = "app/(app)/settings/page.tsx";

function slugify(s) {
  return (
    "settings-" +
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40)
  );
}

let src = readFileSync(FILE, "utf8");

// Pattern: <label className="...">LABEL_TEXT</label>\s*<(input|select)\b([^>]*?)(\/?>|>)
const labelInputRe =
  /<label className="([^"]+)">([^<]+)<\/label>(\s*)<(input|select)\b([\s\S]*?)(\/?>|>)/g;

const usedSlugs = new Map(); // slug → count, to disambiguate duplicates
let changes = 0;

src = src.replace(
  labelInputRe,
  (full, className, text, ws, tag, attrs, close) => {
    // Skip if input already has an id=
    if (/\bid=/.test(attrs)) return full;
    // Skip if label already has htmlFor= (defensive — pattern wouldn't match anyway)
    if (className.includes("htmlFor")) return full;

    let slug = slugify(text.trim());
    if (!slug || slug === "settings-") return full;

    const n = (usedSlugs.get(slug) || 0) + 1;
    usedSlugs.set(slug, n);
    if (n > 1) slug = `${slug}-${n}`;

    changes++;

    // Inject htmlFor into label
    const newLabel = `<label htmlFor="${slug}" className="${className}">${text}</label>`;
    // Inject id into input/select (right after the tag name)
    const newOpen = `<${tag} id="${slug}"${attrs}${close}`;

    return `${newLabel}${ws}${newOpen}`;
  }
);

writeFileSync(FILE, src, "utf8");
console.log(`Patched ${changes} label/input pair(s) in ${FILE}.`);
