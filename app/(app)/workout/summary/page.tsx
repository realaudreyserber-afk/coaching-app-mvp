"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Weight, Timer, Trophy, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VolumeStatCard } from "@/components/workout/volume-stat-card";

/**
 * /workout/summary — récap après une séance terminée.
 *
 * Stitch ref : workout-summary-d.jpg ("Mission Accomplie" + 3 KPI cards
 * Volume/Time/PRs + Share Your Success grid).
 *
 * Phase 1 : route statique avec mock data. Phase 2 : route dynamique
 * /workout/summary/[sessionId] avec lecture Firestore users/{uid}/workouts/{id}.
 */

const MOCK_SESSION = {
  athleteFirstName: "Athlète",
  totalVolumeKg: 12450,
  durationLabel: "1 h 15 min",
  prCount: 3,
  highlights: [
    {
      label: "Record Développé Couché",
      value: "100 kg",
      meta: "Nouveau PR",
    },
    {
      label: "Volume séance",
      value: "12 450 kg",
      meta: "+8 % vs semaine passée",
    },
    {
      label: "Durée totale",
      value: "1 h 15 min",
      meta: "RPE moyen 7/10",
    },
  ],
};

export default function WorkoutSummaryPage() {
  const router = useRouter();
  const session = MOCK_SESSION;

  const handleShare = (highlight: (typeof MOCK_SESSION.highlights)[number]) => {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      navigator
        .share({
          title: `${highlight.label} — NoDream`,
          text: `${highlight.label} : ${highlight.value} (${highlight.meta})`,
        })
        .catch(() => {
          // user cancelled, no-op
        });
    }
  };

  return (
    <div className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10 space-y-10">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/dashboard")}
          aria-label="Retour au tableau de bord"
          className="h-11 w-11"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Button>
        <span className="text-[10px] uppercase tracking-widest font-semibold text-amber-500">
          Séance terminée
        </span>
      </div>

      {/* Hero */}
      <header className="text-center space-y-3">
        <h1 className="text-4xl lg:text-5xl font-bold font-serif text-amber-400">
          Mission accomplie
        </h1>
        <p className="text-base text-zinc-400 max-w-xl mx-auto">
          Excellente séance, {session.athleteFirstName}. Voici ton récap.
        </p>
      </header>

      {/* 3 KPI radial cards */}
      <section
        aria-label="Statistiques de la séance"
        className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-2xl mx-auto"
      >
        <VolumeStatCard
          label="Volume"
          value={session.totalVolumeKg.toLocaleString("fr-FR")}
          unit="kg"
          icon={Weight}
        />
        <VolumeStatCard
          label="Durée"
          value={session.durationLabel}
          icon={Timer}
        />
        <VolumeStatCard
          label="Records"
          value={session.prCount}
          unit={session.prCount > 1 ? "battus" : "battu"}
          icon={Trophy}
        />
      </section>

      {/* Share grid */}
      <section className="space-y-4">
        <h2 className="text-xl lg:text-2xl font-serif font-bold text-zinc-50 text-center">
          Partage ta victoire
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {session.highlights.map((h, idx) => (
            <article
              key={idx}
              className="relative overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 p-5 flex flex-col gap-3 hover:border-amber-500/40 transition-colors"
            >
              <span className="text-[10px] uppercase tracking-widest font-semibold text-amber-500">
                {h.label}
              </span>
              <span className="text-2xl font-bold font-serif text-zinc-50 tabular-nums">
                {h.value}
              </span>
              <span className="text-xs text-zinc-400">{h.meta}</span>
              <button
                type="button"
                onClick={() => handleShare(h)}
                aria-label={`Partager : ${h.label}`}
                className="mt-2 inline-flex items-center justify-center gap-2 h-9 rounded-md bg-amber-500 text-zinc-950 text-sm font-semibold hover:bg-amber-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
              >
                <Share2 className="h-4 w-4" aria-hidden="true" />
                Partager
              </button>
            </article>
          ))}
        </div>
      </section>

      <p className="text-center text-xs text-zinc-500 max-w-md mx-auto">
        Cette page sera bientôt connectée à tes séances logguées. Pour l&apos;instant,
        elle affiche un exemple — le coach IA t&apos;aidera à logguer ta première
        séance.
      </p>
    </div>
  );
}
