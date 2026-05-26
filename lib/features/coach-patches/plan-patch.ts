/**
 * Coach Plan Patch — whitelist + validation of fields the coach is allowed
 * to modify on the active plan via `<COACH_PLAN_PATCH>{...}</COACH_PLAN_PATCH>`
 * blocks emitted in its conversational replies.
 *
 * Design intent (Wave 6A):
 *   - Coach can adjust kcal, macros, training frequency, cardio params, replace
 *     individual meal templates, swap exercises, modify rest_seconds.
 *   - Coach CAN'T touch identity/profile fields (use <COACH_SAVE>),
 *     subscription, payments, scientific corpus, or anything outside the
 *     active plan.
 *   - Every patch is range-validated server-side. Anything outside the
 *     whitelist is silently rejected.
 *   - The old plan is archived in users/{uid}/plans_history/{ISO_ts} BEFORE
 *     the patch is applied (transactional) — never lose history.
 *
 * Schema notes (matches types/plan.ts):
 *   kcal             : number 800-6000
 *   macros.p/c/f     : number 0-600 (grams)
 *   training.sessions[i].frequency_weekly : 1-7
 *   training.sessions[i].exercises[j].sets : 1-10
 *   training.sessions[i].exercises[j].reps : string (range like "8-12")
 *   training.sessions[i].exercises[j].rest_seconds : 0-600
 *   cardio.frequency_weekly  : 0-7
 *   cardio.duration_minutes  : 0-180
 *   cardio.intensity         : 'basse' | 'modérée' | 'haute'
 *   cardio.type              : string (free text, capped at 60 chars)
 *   meals_template[i].name/description : string (capped)
 *   meals_template[i].approx_kcal : 0-3000
 *   supplements[i].name/dosage/timing : string (capped)
 *
 * Anti-tamper:
 *   - Paths must match exact regex (see ALLOWED_PATTERNS).
 *   - Numeric ranges enforced.
 *   - Strings length-capped.
 *   - Array index ≤ 20.
 */

export type PatchValue = string | number | boolean | null;

export interface PatchEntry {
  path: string; // e.g. "kcal" | "macros.p" | "training.sessions.0.exercises.2.reps"
  value: PatchValue;
}

export interface PatchValidationResult {
  accepted: PatchEntry[];
  rejected: Array<{ path: string; reason: string }>;
}

interface PathRule {
  pattern: RegExp;
  type: 'number' | 'string' | 'enum';
  min?: number;
  max?: number;
  maxLen?: number;
  enumValues?: string[];
  /**
   * Wave 6 review H4 fix : `null` is destructive for mandatory numeric scalars
   * (downstream code does `plan.kcal * factor` → NaN). Only optional fields
   * accept null (clearing a textual hint, a supplement entry, etc.).
   */
  nullable?: boolean;
}

const ALLOWED_PATTERNS: PathRule[] = [
  // Calories — H2 fix : min raised from 800 to 1200 (women WHO floor).
  // Below that, the plan-generator safety guidance is violated. If a tighter
  // deficit is needed it should come from generate-plan with full medical
  // context, not from a chat-emitted patch.
  { pattern: /^kcal$/, type: 'number', min: 1200, max: 6000 },

  // Macros — mandatory numeric, no null
  { pattern: /^macros\.p$/, type: 'number', min: 0, max: 600 },
  { pattern: /^macros\.c$/, type: 'number', min: 0, max: 700 },
  { pattern: /^macros\.f$/, type: 'number', min: 0, max: 300 },

  // Training sessions
  { pattern: /^training\.sessions\.([0-9]|1[0-9]|20)\.frequency_weekly$/, type: 'number', min: 1, max: 7 },
  { pattern: /^training\.sessions\.([0-9]|1[0-9]|20)\.name$/, type: 'string', maxLen: 80 },

  // Training exercises
  { pattern: /^training\.sessions\.([0-9]|1[0-9]|20)\.exercises\.([0-9]|1[0-9]|20)\.sets$/, type: 'number', min: 1, max: 10 },
  { pattern: /^training\.sessions\.([0-9]|1[0-9]|20)\.exercises\.([0-9]|1[0-9]|20)\.reps$/, type: 'string', maxLen: 20 },
  { pattern: /^training\.sessions\.([0-9]|1[0-9]|20)\.exercises\.([0-9]|1[0-9]|20)\.rest_seconds$/, type: 'number', min: 0, max: 600 },
  { pattern: /^training\.sessions\.([0-9]|1[0-9]|20)\.exercises\.([0-9]|1[0-9]|20)\.name$/, type: 'string', maxLen: 80 },

  // Cardio — mandatory shape, no nulls
  { pattern: /^cardio\.frequency_weekly$/, type: 'number', min: 0, max: 7 },
  { pattern: /^cardio\.duration_minutes$/, type: 'number', min: 0, max: 180 },
  { pattern: /^cardio\.intensity$/, type: 'enum', enumValues: ['basse', 'modérée', 'haute'] },
  { pattern: /^cardio\.type$/, type: 'string', maxLen: 60, nullable: true },

  // Meals template — description is optional/clearable
  { pattern: /^meals_template\.([0-9]|1[0-9]|20)\.name$/, type: 'string', maxLen: 60 },
  { pattern: /^meals_template\.([0-9]|1[0-9]|20)\.description$/, type: 'string', maxLen: 600, nullable: true },
  { pattern: /^meals_template\.([0-9]|1[0-9]|20)\.approx_kcal$/, type: 'number', min: 0, max: 3000 },

  // Supplements — entire entry clearable via null on any sub-field
  { pattern: /^supplements\.([0-9]|1[0-9]|20)\.name$/, type: 'string', maxLen: 80, nullable: true },
  { pattern: /^supplements\.([0-9]|1[0-9]|20)\.dosage$/, type: 'string', maxLen: 80, nullable: true },
  { pattern: /^supplements\.([0-9]|1[0-9]|20)\.timing$/, type: 'string', maxLen: 80, nullable: true },

  // Lifestyle notes — clearable
  { pattern: /^lifestyle_notes$/, type: 'string', maxLen: 1200, nullable: true },
];

/**
 * Validate a single (path, value) pair against the whitelist.
 * Returns null if accepted, or a string reason if rejected.
 */
export function validatePatchEntry(path: string, value: PatchValue): string | null {
  const rule = ALLOWED_PATTERNS.find((r) => r.pattern.test(path));
  if (!rule) return 'path_not_whitelisted';
  if (value === null) {
    return rule.nullable ? null : 'null_not_allowed_for_mandatory_field';
  }
  if (rule.type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) return 'not_a_number';
    if (rule.min !== undefined && value < rule.min) return `below_min_${rule.min}`;
    if (rule.max !== undefined && value > rule.max) return `above_max_${rule.max}`;
    return null;
  }
  if (rule.type === 'string') {
    if (typeof value !== 'string') return 'not_a_string';
    if (rule.maxLen !== undefined && value.length > rule.maxLen) return `too_long_${rule.maxLen}`;
    return null;
  }
  if (rule.type === 'enum') {
    if (typeof value !== 'string') return 'not_a_string';
    if (rule.enumValues && !rule.enumValues.includes(value)) return 'not_in_enum';
    return null;
  }
  return 'unknown_type';
}

/**
 * Validate an array of patch entries. Splits into accepted + rejected.
 */
export function validatePatch(entries: PatchEntry[]): PatchValidationResult {
  const accepted: PatchEntry[] = [];
  const rejected: Array<{ path: string; reason: string }> = [];
  for (const e of entries) {
    if (!e || typeof e.path !== 'string') {
      rejected.push({ path: String(e?.path ?? '?'), reason: 'invalid_entry' });
      continue;
    }
    const reason = validatePatchEntry(e.path, e.value);
    if (reason) rejected.push({ path: e.path, reason });
    else accepted.push(e);
  }
  return { accepted, rejected };
}

/**
 * Apply a flat patch list to a nested plan object via deep-set. Returns a
 * new object; doesn't mutate input.
 *
 * Supports array index navigation: "training.sessions.0.exercises.2.sets"
 *   → cursor = plan.training.sessions[0].exercises[2].sets
 */
export function applyPatchToPlan<T extends Record<string, any>>(
  plan: T,
  patch: PatchEntry[],
): T {
  // Deep clone via structuredClone if available, else JSON fallback.
  const clone: T =
    typeof structuredClone === 'function'
      ? structuredClone(plan)
      : JSON.parse(JSON.stringify(plan));

  for (const entry of patch) {
    const parts = entry.path.split('.');
    let cursor: any = clone;
    for (let i = 0; i < parts.length - 1; i++) {
      const key = parts[i];
      const isIndex = /^\d+$/.test(key);
      if (isIndex) {
        const idx = parseInt(key, 10);
        if (!Array.isArray(cursor)) {
          // structural mismatch — skip
          cursor = null;
          break;
        }
        if (cursor[idx] === undefined) {
          cursor = null;
          break;
        }
        cursor = cursor[idx];
      } else {
        if (typeof cursor !== 'object' || cursor === null) {
          cursor = null;
          break;
        }
        if (cursor[key] === undefined || cursor[key] === null) {
          cursor[key] = {};
        }
        cursor = cursor[key];
      }
    }
    if (cursor !== null) {
      const last = parts[parts.length - 1];
      const isIndex = /^\d+$/.test(last);
      if (isIndex && Array.isArray(cursor)) {
        cursor[parseInt(last, 10)] = entry.value;
      } else if (typeof cursor === 'object' && cursor !== null) {
        cursor[last] = entry.value;
      }
    }
  }
  return clone;
}

/**
 * Parse a free-form JSON payload extracted from `<COACH_PLAN_PATCH>{...}</...>`
 * into a normalized PatchEntry array.
 *
 * Accepts two formats:
 *   1. Flat object: { "kcal": 2200, "macros.p": 180 }
 *   2. Array form: [{"path": "kcal", "value": 2200}, ...]
 *
 * Throws if neither shape matches.
 */
export function parsePatchPayload(raw: unknown): PatchEntry[] {
  if (Array.isArray(raw)) {
    return raw
      .filter((e) => e && typeof e === 'object' && 'path' in e)
      .map((e) => ({ path: String((e as PatchEntry).path), value: (e as PatchEntry).value }));
  }
  if (raw && typeof raw === 'object') {
    return Object.entries(raw as Record<string, PatchValue>).map(([path, value]) => ({ path, value }));
  }
  throw new Error('patch_payload_unrecognized');
}
