/**
 * POST /api/ai/coach-session-debrief
 *
 * Body: { session_id: string }
 *
 * Returns a short ORACLE.IA debrief (3-5 sentences) of the just-finished
 * session, comparing it to the previous session of the same `operation_name`
 * if available. Caches the debrief in users/{uid}/session_debriefs/{sessionId}
 * so reloading /workout/summary doesn't reprompt Vertex.
 *
 * Used by /workout/summary after a session.finish.
 */
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { withAuth } from "@/lib/firebase/auth-middleware";
import { checkRateLimit } from "@/lib/firebase/rate-limit";
import { generateText } from "@/lib/vertex/client";
import { COACH_SYSTEM_PROMPT } from "@/lib/vertex/prompts/coach";
import type { SessionDoc } from "@/types/session";

export const runtime = "nodejs";

const DEBRIEF_INSTRUCTION = `
Tu es ORACLE.IA, coach NoDream. Tu débriefes une séance de musculation que l'utilisateur vient de terminer.

FORMAT IMPÉRATIF :
- 3 à 5 phrases courtes, ton sec, tactical, factuel.
- Pas de blabla, pas de motivation creuse.
- Si vs_previous_volume_pct > +5 % : signale la progression.
- Si vs_previous_volume_pct < -5 % : pose la question (récup ? sommeil ? cut ?).
- Mentionne le top_lift si présent.
- Si completion_pct < 80 % : signale la séance écourtée sans juger.
- Si le RPE moyen est élevé (> 8.5) : suggère un deload bientôt.
- Si l'utilisateur a un objectif (perte, recompo, gain) : relie la séance à cet objectif.

Format de sortie : texte brut, FR, sans markdown, sans \`<COACH_SAVE>\`, 60-120 mots max.
`;

export async function POST(req: NextRequest) {
  return withAuth(req, async (_authReq, user) => {
    try {
      const uid = user.uid;

      const rl = await checkRateLimit(uid, {
        scope: "ai_session_debrief",
        perMinute: 6,
        perHour: 30,
      });
      if (!rl.ok) {
        return NextResponse.json(
          { error: "Trop de debriefs récents.", retryAfterSec: rl.retryAfterSec },
          { status: 429 },
        );
      }

      let body: { session_id?: string };
      try {
        body = await req.json();
      } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
      }
      if (!body.session_id) {
        return NextResponse.json({ error: "session_id required" }, { status: 400 });
      }

      const userRef = adminDb.collection("users").doc(uid);
      const sessionRef = userRef.collection("workout_sessions").doc(body.session_id);

      // 1. Return cached debrief if already generated (idempotent on summary reload)
      const debriefRef = userRef.collection("session_debriefs").doc(body.session_id);
      const cached = await debriefRef.get();
      if (cached.exists) {
        const cachedData = cached.data();
        return NextResponse.json({
          ok: true,
          cached: true,
          debrief: cachedData?.text,
          generated_at: cachedData?.generated_at,
        });
      }

      const [sessionSnap, userSnap] = await Promise.all([sessionRef.get(), userRef.get()]);
      if (!sessionSnap.exists) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }
      const session = sessionSnap.data() as SessionDoc;
      if (session.status === "in_progress") {
        return NextResponse.json(
          { error: "Session still in progress; finish it first" },
          { status: 409 },
        );
      }
      if (session.status === "aborted") {
        return NextResponse.json(
          { error: "Session abandonnée — pas de debrief généré." },
          { status: 409 },
        );
      }

      const userData = userSnap.data() ?? {};
      const goals = userData.goals ?? {};
      const profile = userData.profile ?? {};

      // 2. Build compact context for the debrief — no need to inject the full
      // system prompt + RAG. Just the session metrics + profile basics + goal.
      const avgRpe = session.exercises.length
        ? Number(
            (
              session.exercises
                .flatMap((ex) => ex.sets_logged.map((s) => s.rpe_felt))
                .reduce((sum, r) => sum + r, 0) /
              Math.max(
                1,
                session.exercises.flatMap((ex) => ex.sets_logged).length,
              )
            ).toFixed(1),
          )
        : null;

      const compactCtx = {
        session_code: session.session_code,
        operation_name: session.operation_name,
        session_type: session.session_type,
        duration_min: Math.round(session.metrics.duration_seconds / 60),
        volume_kg: session.metrics.volume_kg,
        completion_pct: session.metrics.completion_pct,
        vs_previous_volume_pct: session.metrics.vs_previous_volume_pct,
        sets_completed: session.metrics.sets_completed,
        sets_planned: session.metrics.sets_planned,
        avg_rpe: avgRpe,
        top_lift: findTopLiftFromSession(session),
        user_level: session.user_level_snapshot,
        user_goal: goals.primary_goal ?? goals.type ?? "non précisé",
        user_name: profile.name ?? "athlète",
      };

      const promptText = `Données de la séance :\n${JSON.stringify(compactCtx, null, 2)}`;

      const debrief = await generateText({
        model: process.env.VERTEX_AI_MODEL_FLASH || "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: promptText }] }],
        // We reuse the coach base prompt only for tone/identity, then override
        // the task with the debrief instruction.
        systemInstruction: `${COACH_SYSTEM_PROMPT.slice(0, 2000)}\n\n${DEBRIEF_INSTRUCTION}`,
        temperature: 0.4,
      });

      const text = (debrief ?? "").trim();
      if (!text) {
        return NextResponse.json({ error: "Empty debrief from model" }, { status: 502 });
      }

      // 3. Cache
      await debriefRef.set({
        session_id: body.session_id,
        text,
        generated_at: new Date().toISOString(),
      });

      return NextResponse.json({ ok: true, cached: false, debrief: text });
    } catch (err) {
      console.error("[coach-session-debrief] failed:", err);
      const message = err instanceof Error ? err.message : "internal_error";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}

function findTopLiftFromSession(session: SessionDoc) {
  let bestE1rm = 0;
  let best: { exercise_name: string; weight_kg: number; reps_done: number; rpe_felt: number } | undefined;
  for (const ex of session.exercises) {
    for (const set of ex.sets_logged) {
      const load = (set.weight_kg ?? 0) + (set.loaded_kg ?? 0);
      if (load <= 0) continue;
      const e1rm = load * (1 + set.reps_done / 30);
      if (e1rm > bestE1rm) {
        bestE1rm = e1rm;
        best = {
          exercise_name: ex.exercise_name,
          weight_kg: load,
          reps_done: set.reps_done,
          rpe_felt: set.rpe_felt,
        };
      }
    }
  }
  return best;
}
