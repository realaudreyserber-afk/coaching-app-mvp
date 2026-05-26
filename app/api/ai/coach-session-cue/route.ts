/**
 * POST /api/ai/coach-session-cue
 *
 * Body: {
 *   exercise_id: string,
 *   exercise_name: string,
 *   trigger: 'set_start' | 'set_finish' | 'rest_start' | 'rest_end' | 'session_start',
 *   set_index?: number,
 *   target_sets?: number,
 *   target_reps_range?: string,
 *   target_rpe?: number,
 *   weight_kg?: number,
 *   reps_done?: number,
 *   rpe_felt?: number,
 *   last_performance?: { weight_kg: number; reps_done: number; rpe_felt: number; days_ago: number },
 * }
 *
 * Returns: { text: string } — 1-2 short FR sentences for TTS playback.
 *
 * Used by /session/live to generate dynamic coaching cues instead of
 * hardcoded "Garde la barre droite..." strings. The text is then passed
 * to /api/ai/coach-audio for TTS rendering.
 *
 * Module-level LRU cache keyed by (exercise_id, trigger, set_index) so
 * repeated invocations within a single session don't reprompt Vertex.
 */
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/firebase/auth-middleware";
import { checkRateLimit } from "@/lib/firebase/rate-limit";
import { generateText } from "@/lib/vertex/client";
import { findExerciseById } from "@/lib/features/exercises";

export const runtime = "nodejs";

// Module-level cache: simple Map with FIFO eviction at 200 entries.
// Module-level cache. NOTE: this is per-server-instance (Vercel serverless
// can run multiple instances), so hit-rate degrades with horizontal scaling.
// Acceptable trade-off for an MVP TTS cache. Migrate to Firestore
// users/{uid}/ai_cache/cue_{key} if persistence matters.
const CACHE = new Map<string, { text: string; created_at: number }>();
const CACHE_MAX = 1000;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min

function cacheKey(uid: string, body: CueBody): string {
  return `${uid}|${body.exercise_id}|${body.trigger}|${body.set_index ?? 0}`;
}

function getCached(key: string): string | undefined {
  const entry = CACHE.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.created_at > CACHE_TTL_MS) {
    CACHE.delete(key);
    return undefined;
  }
  return entry.text;
}

function setCached(key: string, text: string): void {
  if (CACHE.size >= CACHE_MAX) {
    // Evict oldest entry
    const firstKey = CACHE.keys().next().value;
    if (firstKey) CACHE.delete(firstKey);
  }
  CACHE.set(key, { text, created_at: Date.now() });
}

interface CueBody {
  exercise_id: string;
  exercise_name: string;
  trigger: "set_start" | "set_finish" | "rest_start" | "rest_end" | "session_start";
  set_index?: number;
  target_sets?: number;
  target_reps_range?: string;
  target_rpe?: number;
  weight_kg?: number;
  reps_done?: number;
  rpe_felt?: number;
  last_performance?: {
    weight_kg: number;
    reps_done: number;
    rpe_felt: number;
    days_ago: number;
  };
}

const CUE_INSTRUCTION = `Tu es ORACLE.IA, coach NoDream. Tu génères 1 cue d'entraînement à dire en audio à un athlète pendant sa séance de musculation.

CONTRAINTES IMPÉRATIVES :
- 1 à 2 phrases courtes, 15-25 mots TOTAL maximum.
- FR, tutoiement, ton tactical sec, jamais mielleux.
- Pas de "Allez !", "Tu peux le faire !", "Champion", "Bravo".
- Tu peux référencer la technique précise de l'exercice (1 cue clé) ou la performance comparative vs la dernière fois.
- Pour set_start : focus technique. Pour set_finish : reconnaissance factuelle (reps, RPE). Pour rest_start : annonce repos + 1 conseil micro. Pour rest_end : focus prochaine série.
- AUCUN markdown, AUCUNE balise, AUCUNE ponctuation atypique. Phrase brute prête à être lue par un TTS.

Format de sortie : juste le texte du cue, sans guillemets, sans entête.`;

export async function POST(req: NextRequest) {
  return withAuth(req, async (_authReq, user) => {
    try {
      const uid = user.uid;

      // Higher rate-limit than coach chat since the session live calls this
      // multiple times per minute (at each set validation + rest end).
      // 60/min covers a typical superset block (4 set_finish + 4 rest_end + 4
      // set_start per exo × 3 exos in 5 min = ~36/5min). 600/h caps abuse.
      const rl = await checkRateLimit(uid, {
        scope: "ai_session_cue",
        perMinute: 60,
        perHour: 600,
      });
      if (!rl.ok) {
        return NextResponse.json(
          { error: "rate_limited", retry_after_sec: rl.retryAfterSec },
          { status: 429 },
        );
      }

      let body: CueBody;
      try {
        body = await req.json();
      } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
      }
      if (!body.exercise_id || !body.trigger) {
        return NextResponse.json(
          { error: "exercise_id and trigger required" },
          { status: 400 },
        );
      }

      // Cache hit short-circuit
      const key = cacheKey(uid, body);
      const cached = getCached(key);
      if (cached) {
        return NextResponse.json({ text: cached, cached: true });
      }

      // Enrich exercise context with canonical cues
      const exoMeta = findExerciseById(body.exercise_id);
      const ctx = {
        exercise: body.exercise_name,
        trigger: body.trigger,
        set_index: body.set_index,
        target_sets: body.target_sets,
        target_reps_range: body.target_reps_range,
        target_rpe: body.target_rpe,
        last_set: {
          weight_kg: body.weight_kg,
          reps_done: body.reps_done,
          rpe_felt: body.rpe_felt,
        },
        last_performance: body.last_performance,
        primary_muscles: exoMeta?.primary_muscles,
        technical_cues: exoMeta?.cues_technique?.slice(0, 2),
        safety_note: exoMeta?.safety_notes,
      };

      const text = await generateText({
        model: process.env.VERTEX_AI_MODEL_FLASH || "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [{ text: `Contexte :\n${JSON.stringify(ctx, null, 2)}` }],
          },
        ],
        systemInstruction: CUE_INSTRUCTION,
        temperature: 0.6,
      });

      const cleaned = (text ?? "")
        .trim()
        .replace(/^["«]|["»]$/g, "")
        .replace(/\s+/g, " ")
        .slice(0, 250);

      if (!cleaned) {
        return NextResponse.json({ error: "empty_cue" }, { status: 502 });
      }

      setCached(key, cleaned);
      return NextResponse.json({ text: cleaned, cached: false });
    } catch (err) {
      console.error("[coach-session-cue] failed:", err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "internal_error" },
        { status: 500 },
      );
    }
  });
}
