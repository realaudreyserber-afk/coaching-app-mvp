/**
 * POST /api/ai/coach-meal-feedback
 *
 * Body: {
 *   meal: { name?: string; kcal: number; macros: { p: number; c: number; f: number } }
 * }
 *
 * Returns: { feedback: string } — 1-3 phrases ORACLE.IA évaluant si ce repas
 * colle avec les macros restantes du jour, avant qu'il soit loggué pour de bon
 * (ou immédiatement après).
 *
 * Used by /log/photo + /log/recipe + /log/barcode + /log/voice après le
 * recognize/OCR/scan, pour donner un feedback contextuel rapide.
 *
 * Cache désactivé : chaque appel a un contexte unique (le restant du jour
 * change après chaque repas).
 */
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { withAuth } from "@/lib/firebase/auth-middleware";
import { checkRateLimit } from "@/lib/firebase/rate-limit";
import { generateText } from "@/lib/vertex/client";
import { extractPlanKcal } from "@/lib/vertex/context-fetcher";

export const runtime = "nodejs";

const FEEDBACK_INSTRUCTION = `Tu es ORACLE.IA, coach NoDream. Tu commentes un repas que l'utilisateur vient de logguer ou s'apprête à logguer.

CONTRAINTES :
- 2 à 3 phrases FR, tutoiement, ton sec et factuel.
- Vérifie si ce repas + ce qui a déjà été mangé aujourd'hui dépasse / sous-utilise la cible kcal du plan.
- Si dépassement : signale-le sec, suggère un ajustement (ex: "tu seras à +320 kcal sur la journée → marche 30 min ou repas du soir plus light").
- Si pile dans la cible : valide en une phrase, sans flatterie.
- Si très en dessous : indique le restant à consommer, suggère un repas type qui complète bien les macros manquantes.
- Pas de markdown, pas de balise <COACH_SAVE>, pas de citation source.
- 40-90 mots max.`;

interface MealPayload {
  name?: string;
  kcal: number;
  macros: { p: number; c: number; f: number };
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (_authReq, user) => {
    try {
      const uid = user.uid;

      const rl = await checkRateLimit(uid, {
        scope: "ai_meal_feedback",
        perMinute: 10,
        perHour: 60,
      });
      if (!rl.ok) {
        return NextResponse.json(
          { error: "rate_limited", retry_after_sec: rl.retryAfterSec },
          { status: 429 },
        );
      }

      let body: { meal?: MealPayload };
      try {
        body = await req.json();
      } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
      }
      if (!body?.meal || typeof body.meal.kcal !== "number") {
        return NextResponse.json({ error: "meal{kcal,macros} required" }, { status: 400 });
      }

      // Load user + active plan + today food aggregate inline (3 reads instead
      // of running the full fetchEnrichmentContext which makes 6).
      const userRef = adminDb.collection("users").doc(uid);
      const startOfToday = new Date();
      startOfToday.setUTCHours(0, 0, 0, 0);

      const [userSnap, plansSnap, foodLogsSnap] = await Promise.all([
        userRef.get(),
        userRef.collection("plans").where("active", "==", true).limit(1).get(),
        userRef
          .collection("food_logs")
          .where("logged_at", ">=", startOfToday.toISOString())
          .limit(30)
          .get(),
      ]);
      const userData = userSnap.data() ?? {};
      const activePlan = plansSnap.empty ? undefined : plansSnap.docs[0].data();
      const kcalTarget = extractPlanKcal(activePlan);
      const macrosTarget = (activePlan as { macros?: { p: number; c: number; f: number } } | undefined)?.macros;

      let todayKcal = 0;
      const todayMacros = { p: 0, c: 0, f: 0 };
      foodLogsSnap.forEach((d) => {
        const t = d.data().totals as { kcal?: number; p?: number; c?: number; f?: number } | undefined;
        todayKcal += t?.kcal ?? 0;
        todayMacros.p += t?.p ?? 0;
        todayMacros.c += t?.c ?? 0;
        todayMacros.f += t?.f ?? 0;
      });
      const today = foodLogsSnap.empty
        ? undefined
        : {
            kcal_total: Math.round(todayKcal),
            macros_total: {
              p: Math.round(todayMacros.p),
              c: Math.round(todayMacros.c),
              f: Math.round(todayMacros.f),
            },
            count: foodLogsSnap.size,
          };

      const ctx = {
        meal_to_evaluate: {
          name: body.meal.name ?? "repas",
          kcal: Math.round(body.meal.kcal),
          macros: {
            p: Math.round(body.meal.macros.p),
            c: Math.round(body.meal.macros.c),
            f: Math.round(body.meal.macros.f),
          },
        },
        plan_target: {
          kcal_daily: kcalTarget,
          macros_daily: macrosTarget,
        },
        today_consumed_before_this_meal: today
          ? {
              kcal_total: today.kcal_total,
              macros_total: today.macros_total,
              meals_count: today.count,
            }
          : { kcal_total: 0, macros_total: { p: 0, c: 0, f: 0 }, meals_count: 0 },
        // Projected if this meal is logged
        projected_total: kcalTarget
          ? {
              kcal: (today?.kcal_total ?? 0) + Math.round(body.meal.kcal),
              delta_vs_target: (today?.kcal_total ?? 0) + Math.round(body.meal.kcal) - kcalTarget,
            }
          : undefined,
        user_name: userData.profile?.name,
      };

      const feedback = await generateText({
        model: process.env.VERTEX_AI_MODEL_FLASH || "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: `Contexte :\n${JSON.stringify(ctx, null, 2)}` }] }],
        systemInstruction: FEEDBACK_INSTRUCTION,
        temperature: 0.4,
      });

      const text = (feedback ?? "").trim().slice(0, 600);
      if (!text) {
        return NextResponse.json({ error: "empty_feedback" }, { status: 502 });
      }
      return NextResponse.json({ feedback: text });
    } catch (err) {
      console.error("[coach-meal-feedback] failed:", err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "internal_error" },
        { status: 500 },
      );
    }
  });
}
