"use client";

import * as React from "react";
import Image from "next/image";
import { Play, Timer } from "lucide-react";

/**
 * Exercise Card — un exercice de musculation avec preview vidéo (ou placeholder),
 * sets × reps, temps de repos, et bouton "Logger série" optionnel.
 *
 * Stitch ref : training-detail-d.jpg (grid 2x2 d'exercices avec video thumbnails)
 */

export interface ExerciseCardData {
  /** Nom de l'exercice (ex: "Barbell Back Squat") */
  name: string;
  /** Sets cibles */
  sets: number;
  /** Reps cibles (ex: "8" ou "8-10") */
  reps: string | number;
  /** Temps de repos en secondes */
  restSeconds?: number;
  /** URL de la preview vidéo (placeholder si absent) */
  videoUrl?: string;
  /** URL d'un poster image pour la vidéo */
  posterUrl?: string;
}

interface ExerciseCardProps {
  exercise: ExerciseCardData;
  /** Numéro de l'exercice dans le programme (1, 2, 3...) */
  index?: number;
  /** Callback du bouton "Logger série" */
  onLogSet?: () => void;
  /** Numéro de série en cours (ex: 1 pour "Logger série 1") */
  currentSet?: number;
  className?: string;
}

export function ExerciseCard({
  exercise,
  index,
  onLogSet,
  currentSet = 1,
  className = "",
}: ExerciseCardProps) {
  return (
    <article
      className={`group relative overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 transition-all hover:border-amber-500/40 ${className}`}
    >
      {/* Video preview / placeholder */}
      <div className="relative aspect-video bg-zinc-800 overflow-hidden">
        {exercise.posterUrl ? (
          <Image
            src={exercise.posterUrl}
            alt={`Aperçu : ${exercise.name}`}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <ExercisePlaceholder name={exercise.name} />
        )}
        {/* Play overlay */}
        {exercise.videoUrl && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="h-12 w-12 rounded-full bg-amber-500/90 flex items-center justify-center shadow-lg">
              <Play
                className="h-5 w-5 text-zinc-950 fill-zinc-950 translate-x-0.5"
                aria-hidden="true"
              />
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        <div className="flex items-baseline gap-2">
          {index !== undefined && (
            <span className="text-amber-500 font-serif font-bold text-base tabular-nums">
              {index}.
            </span>
          )}
          <h3 className="text-base font-serif font-bold text-zinc-50 leading-tight flex-1">
            {exercise.name}
          </h3>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="text-zinc-400">
            <span className="font-semibold text-zinc-100 tabular-nums">
              {exercise.sets}
            </span>{" "}
            Séries ×{" "}
            <span className="font-semibold text-zinc-100 tabular-nums">
              {exercise.reps}
            </span>{" "}
            Reps
          </span>
          {exercise.restSeconds !== undefined && (
            <>
              <span className="text-zinc-700" aria-hidden="true">
                ·
              </span>
              <span className="flex items-center gap-1 text-zinc-400">
                <Timer className="h-3 w-3" aria-hidden="true" />
                <span className="tabular-nums">
                  Repos {exercise.restSeconds}s
                </span>
              </span>
            </>
          )}
        </div>

        {onLogSet && (
          <button
            type="button"
            onClick={onLogSet}
            aria-label={`Logger la série ${currentSet} de ${exercise.name}`}
            className="w-full mt-1 h-9 rounded-md bg-zinc-800 border border-amber-500/40 text-amber-400 text-xs font-semibold hover:bg-amber-500/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
          >
            Logger série {currentSet}
          </button>
        )}
      </div>
    </article>
  );
}

function ExercisePlaceholder({ name }: { name: string }) {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950"
    >
      <span className="font-serif text-4xl font-bold text-amber-500/20 select-none">
        {name.charAt(0).toUpperCase()}
      </span>
      <div className="absolute inset-x-6 bottom-3 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
    </div>
  );
}
