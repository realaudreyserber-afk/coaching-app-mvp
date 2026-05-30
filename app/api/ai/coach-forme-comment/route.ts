/**
 * POST /api/ai/coach-forme-comment
 *
 * No body required (le score est recalculé côté serveur via les MÊMES snapshots
 * que /api/progress/overview, donc strictement cohérent avec ce qui s'affiche
 * dans le hero #forme).
 *
 * Génère 1-2 phrases tactiques sur le score Forme du jour (lecture du driver
 * dominant + action concrète). Cache 4h dans `ai_cache/forme_comment`, invalidé
 * si la date change ou si le score bouge de plus de SCORE_DELTA_REGEN points.
 *
 * Distinct de /api/ai/coach-progress-analysis (qui résume 4 semaines en 5-8
 * phrases, opt-in via bouton, cache 6h). Ici c'est court, auto-load à l'ouverture
 * du Suivi, contextualisé sur la forme du JOUR.
 */
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { withAuth } from "@/lib/firebase/auth-middleware";
import { checkRateLimit } from "@/lib/firebase/rate-limit";
import { generateText } from "@/lib/vertex/client";
import { getSleepSnapshot } from "@/lib/features/sleep/store";
import { getHrvSnapshot } from "@/lib/features/hrv/store";
import { getHydrationSnapshot } from "@/lib/features/hydration/store";
import { computeForme } from "@/lib/features/progress/forme";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FORME_INSTRUCTION = `Tu es ORACLE.IA, coach NoDream. Tu lis le score de FORME DU JOUR d'un athlète et tu rends UN commentaire ultra-court.

CONTRAINTES STRICTES :
- FR, tutoiement, 25-45 mots TOTAL (1-2 phrases maximum).
- Format : lecture sèche du score + driver dominant + UNE consigne pour aujourd'hui.
- Pas de flatterie ("génial", "bravo", "tu gères"). Pas de "n'oublie pas". Pas d'émoji.
- Pas de markdown, pas de balise <COACH_SAVE>, pas de citation.
- Si score < 50 : priorité récup explicite (deload, sieste, sommeil tôt). Interdire PR.
- Si 50-69 : travail normal autorisé, pas d'intensification.
- Si score >= 70 : ouvert à pousser (PR, intensité, volume).
- N'invente PAS de chiffres absents du contexte. Si une donnée manque, ignore-la.`;

const CACHE_TTL_HOURS = 4;
const SCORE_DELTA_REGEN = 8;

export async function POST(req: NextRequest) {
  return withAuth(req, async (_authReq, user) => {
    try {
      const uid = user.uid;

      const rl = await checkRateLimit(uid, {
        scope: "ai_forme_comment",
        perHour: 12,
        perMinute: 3,
      });
      if (!rl.ok) {
        return NextResponse.json(
          { error: "rate_limited", retry_after_sec: rl.retryAfterSec },
          { status: 429 },
        );
      }

      const userRef = adminDb.collection("users").doc(uid);

      // Recalcule la forme avec les snapshots DRY (mêmes que /api/progress/overview)
      // pour garantir la cohérence avec ce qu'affiche le hero.
      const [sleep, hrv, hydration, recentCheckinsSnap] = await Promise.all([
        getSleepSnapshot(uid).catch(() => null),
        getHrvSnapshot(uid).catch(() => null),
        getHydrationSnapshot(uid).catch(() => null),
        userRef
          .collection("checkins_daily")
          .orderBy("created_at", "desc")
          .limit(7)
          .get()
          .catch(() => null),
      ]);

      const energyVals: number[] = [];
      let latestSubj: { energy?: number; mood?: number; hunger?: number; sleep_hours?: number } | null = null;
      if (recentCheckinsSnap && !recentCheckinsSnap.empty) {
        recentCheckinsSnap.forEach((d) => {
          const e = d.data().energy;
          if (typeof e === "number") energyVals.push(e);
        });
        const head = recentCheckinsSnap.docs[0].data();
        latestSubj = {
          energy: typeof head.energy === "number" ? head.energy : undefined,
          mood: typeof head.mood === "number" ? head.mood : undefined,
          hunger: typeof head.hunger === "number" ? head.hunger : undefined,
          sleep_hours: typeof head.sleep_hours === "number" ? head.sleep_hours : undefined,
        };
      }
      const energyAvg = energyVals.length
        ? energyVals.reduce((a, b) => a + b, 0) / energyVals.length
        : null;

      const forme = computeForme({ sleep, hrv, hydration, energyAvg });

      if (forme.score === null) {
        return NextResponse.json({ ok: true, comment: null, reason: "no_data" });
      }

      // Cache : ré-utilisé si frais (4h) ET même jour ET score proche.
      const today = new Date().toISOString().slice(0, 10);
      const cacheRef = userRef.collection("ai_cache").doc("forme_comment");
      const cached = await cacheRef.get();
      if (cached.exists) {
        const data = cached.data();
        const ageMs = Date.now() - new Date(data?.generated_at ?? 0).getTime();
        const sameDay = data?.date_used === today;
        const scoreClose =
          typeof data?.score_used === "number" &&
          Math.abs(forme.score - data.score_used) <= SCORE_DELTA_REGEN;
        if (ageMs < CACHE_TTL_HOURS * 3600 * 1000 && sameDay && scoreClose) {
          return NextResponse.json({
            ok: true,
            cached: true,
            comment: data?.text,
            generated_at: data?.generated_at,
          });
        }
      }

      const ctx = {
        forme: {
          score: forme.score,
          label: forme.label,
          drivers: forme.drivers,
        },
        signals: {
          sleep_avg_7d_h: sleep?.avg_hours_7day,
          sleep_quality_7d: sleep?.avg_quality_7day,
          short_nights_7d: sleep?.short_nights_7day,
          hrv_chronic_drift: hrv?.is_chronic_drift ?? false,
          hrv_avg_7d_ms: hrv?.avg_hrv_7day ?? null,
          hydration_today_pct: hydration
            ? Math.round((hydration.today_effective_ml / Math.max(1, hydration.today_target_ml)) * 100)
            : null,
          hydration_target_hits_7d: hydration?.days_target_hit_7day ?? null,
          energy_avg_recent: energyAvg !== null ? Math.round(energyAvg * 10) / 10 : null,
        },
        latest_checkin: latestSubj,
      };

      const promptText = `Forme du jour à commenter (1-2 phrases tactiques, 25-45 mots) :\n${JSON.stringify(ctx, null, 2)}`;

      const raw = await generateText({
        model: process.env.VERTEX_AI_MODEL_FLASH || "gemini-3.5-flash",
        contents: [{ role: "user", parts: [{ text: promptText }] }],
        systemInstruction: FORME_INSTRUCTION,
        temperature: 0.5,
        maxOutputTokens: 220,
      });
      const text = (raw ?? "").trim();
      if (!text) {
        return NextResponse.json({ error: "empty_comment" }, { status: 502 });
      }

      await cacheRef.set({
        text,
        generated_at: new Date().toISOString(),
        score_used: forme.score,
        date_used: today,
      });

      return NextResponse.json({ ok: true, cached: false, comment: text });
    } catch (err) {
      console.error("[coach-forme-comment] failed:", err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "internal_error" },
        { status: 500 },
      );
    }
  });
}
