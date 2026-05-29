/**
 * Importateur CIQUAL 2025 (ANSES) → table de composition compacte pour NoDream.
 *
 * Lit les XML CIQUAL (const / alim / alim_grp / compo) et produit un JSON
 * compact `lib/features/food-composition/data/ciqual-foods.json` :
 *   [{ c: code, n: nom_fr, g: groupe, v: { kcal, protein_g, iron_mg, ... } }]
 *
 * Le fichier compo fait ~69 Mo → lu en STREAMING (readline), jamais en entier.
 *
 * Usage : node scripts/import-ciqual.mjs "H:/utilisateur/Downloads"
 * Source : Table Ciqual 2025, ANSES — doi 10.57745/RDMHWY (CC).
 */

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const SRC = process.argv[2] || 'H:/utilisateur/Downloads';
const OUT_DIR = path.resolve('lib/features/food-composition/data');
const OUT_FILE = path.join(OUT_DIR, 'ciqual-foods.json');

// const_code CIQUAL → clé compacte (alignée nutrition-db + DailyMicroIntake).
const CONST_MAP = {
  '328': 'kcal',
  '25000': 'protein_g',
  '31000': 'carb_g',
  '32000': 'sugar_g',
  '40000': 'fat_g',
  '40302': 'sat_fat_g',
  '34100': 'fiber_g',
  '10004': 'salt_g',
  '10110': 'sodium_mg',
  '10120': 'magnesium_mg',
  '10150': 'phosphorus_mg',
  '10190': 'potassium_mg',
  '10200': 'calcium_mg',
  '10251': 'manganese_mg',
  '10260': 'iron_mg',
  '10290': 'copper_mg',
  '10300': 'zinc_mg',
  '10340': 'selenium_mcg',
  '10530': 'iodine_mcg',
  '51104': 'vit_a_mcg',
  '52100': 'vit_d_mcg',
  '53100': 'vit_e_mg',
  '54101': 'vit_k_mcg',
  '55100': 'vit_c_mg',
  '56100': 'vit_b1_mg',
  '56200': 'vit_b2_mg',
  '56310': 'vit_b3_mg',
  '56400': 'vit_b5_mg',
  '56500': 'vit_b6_mg',
  '56600': 'vit_b12_mcg',
  '56700': 'vit_b9_mcg',
  '41826': 'omega6_linoleic_g',
  '41833': 'omega3_ala_g',
  '42053': 'epa_g',
  '42263': 'dha_g',
  '75100': 'cholesterol_mg',
};

function tag(block, name) {
  const m = block.match(new RegExp(`<${name}[^>]*>([^<]*)</${name}>`));
  return m ? m[1].trim() : null;
}

/** Parse une teneur CIQUAL : "59,7" -> 59.7 ; "traces" -> 0 ; "< 0,1" -> 0.1 ; "-"/"" -> null. */
function parseTeneur(raw) {
  if (raw == null) return null;
  const s = raw.trim();
  if (!s || s === '-' || s.toLowerCase() === 'nc') return null;
  if (s.toLowerCase() === 'traces') return 0;
  const m = s.replace(',', '.').match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

function round(n) {
  // 4 chiffres significatifs suffisent (micros en µg, macros en g)
  if (n === 0) return 0;
  return Math.round(n * 1000) / 1000;
}

// ── 1. alim_grp : grp_code -> nom_fr (groupe de niveau 1) ──
const grpName = {};
{
  const xml = fs.readFileSync(path.join(SRC, 'alim_grp_2025_11_03.xml'), 'utf8');
  for (const block of xml.match(/<ALIM_GRP>[\s\S]*?<\/ALIM_GRP>/g) || []) {
    const code = tag(block, 'alim_grp_code');
    const nom = tag(block, 'alim_grp_nom_fr');
    if (code && nom && !grpName[code]) grpName[code] = nom;
  }
}

// ── 2. alim : alim_code -> { nom_fr, grp } ──
const foods = {};
{
  const xml = fs.readFileSync(path.join(SRC, 'alim_2025_11_03.xml'), 'utf8');
  for (const block of xml.match(/<ALIM>[\s\S]*?<\/ALIM>/g) || []) {
    const code = tag(block, 'alim_code');
    const nom = tag(block, 'alim_nom_fr');
    const grp = tag(block, 'alim_grp_code');
    if (code) foods[code] = { c: code, n: nom || '', g: grpName[grp] || grp || '', v: {} };
  }
}
console.log(`alim: ${Object.keys(foods).length} aliments, ${Object.keys(grpName).length} groupes`);

// ── 3. compo : streaming (alim_code, const_code, teneur) ──
const compoPath = path.join(SRC, 'compo_2025_11_03.xml');
const rl = readline.createInterface({
  input: fs.createReadStream(compoPath, { encoding: 'utf8' }),
  crlfDelay: Infinity,
});

let curAlim = null;
let curConst = null;
let curTeneur = null;
let kept = 0;
let rows = 0;

for await (const line of rl) {
  if (line.includes('<alim_code>')) curAlim = tag(line, 'alim_code');
  else if (line.includes('<const_code>')) curConst = tag(line, 'const_code');
  else if (line.includes('<teneur')) {
    const m = line.match(/<teneur[^>]*>([^<]*)<\/teneur>/);
    curTeneur = m ? m[1] : null;
  } else if (line.includes('</COMPO>')) {
    rows++;
    const key = CONST_MAP[curConst];
    if (key && curAlim && foods[curAlim]) {
      const val = parseTeneur(curTeneur);
      if (val != null) {
        foods[curAlim].v[key] = round(val);
        kept++;
      }
    }
    curAlim = curConst = curTeneur = null;
  }
}
console.log(`compo: ${rows} lignes lues, ${kept} valeurs retenues (${Object.keys(CONST_MAP).length} constituants)`);

// ── 4. écrire ──
const arr = Object.values(foods)
  .filter((f) => Object.keys(f.v).length > 0)
  .sort((a, b) => Number(a.c) - Number(b.c));

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT_FILE, JSON.stringify(arr));
const sizeMb = (fs.statSync(OUT_FILE).size / 1024 / 1024).toFixed(2);
console.log(`✅ ${arr.length} aliments écrits → ${OUT_FILE} (${sizeMb} Mo)`);
