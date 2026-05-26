"use client";

import * as React from "react";
import Image from "next/image";
import { Play, Timer } from "lucide-react";
import { HudCard } from "@/components/nodream";

/**
 * Exercise Card — NoDream Tactical OS.
 * HudCard gold + poster vidéo en haut + métriques en mono tactical.
 */

export interface ExerciseCardData {
  name: string;
  sets: number;
  reps: string | number;
  restSeconds?: number;
  videoUrl?: string;
  posterUrl?: string;
}

interface ExerciseCardProps {
  exercise: ExerciseCardData;
  index?: number;
  onLogSet?: () => void;
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
    <HudCard
      accent="gold"
      chamfer="sm"
      className={`group overflow-hidden ${className}`}
      style={{ padding: 0, display: "flex", flexDirection: "column" }}
    >
      {/* Video preview / placeholder */}
      <div
        className="relative aspect-video overflow-hidden"
        style={{
          background: "var(--ink-900)",
          borderBottom: "1px solid var(--gold-tint-15)",
        }}
      >
        {exercise.posterUrl ? (
          <Image
            src={exercise.posterUrl}
            alt={`Aperçu : ${exercise.name}`}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            style={{ filter: "grayscale(0.3) contrast(1.1)" }}
          />
        ) : (
          <ExercisePlaceholder name={exercise.name} />
        )}
        {/* Play overlay tactical */}
        {exercise.videoUrl && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className="flex items-center justify-center"
              style={{
                width: 48,
                height: 48,
                background: "var(--gold-400)",
                boxShadow: "var(--glow-gold-soft)",
                clipPath:
                  "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)",
              }}
            >
              <Play
                className="h-5 w-5 translate-x-0.5"
                style={{ color: "var(--ink-900)", fill: "var(--ink-900)" }}
                aria-hidden="true"
              />
            </div>
          </div>
        )}
        {/* Index badge top-left */}
        {index !== undefined && (
          <span
            className="absolute top-2 left-2 mono"
            style={{
              padding: "3px 7px",
              background: "rgba(6, 3, 15, 0.85)",
              color: "var(--gold-400)",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.2em",
              border: "1px solid var(--gold-tint-35)",
              clipPath:
                "polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)",
            }}
          >
            #{index.toString().padStart(2, "0")}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-3 flex-1 flex flex-col">
        <div>
          <span
            className="mono"
            style={{
              fontSize: 9,
              letterSpacing: "0.3em",
              color: "var(--gold-500)",
              opacity: 0.75,
              textTransform: "uppercase",
            }}
          >
            [EXO]
          </span>
          <h3
            style={{
              fontFamily: "var(--font-sans)",
              fontWeight: 900,
              fontSize: 15,
              letterSpacing: "-0.01em",
              color: "var(--fg-1)",
              lineHeight: 1.25,
              margin: "4px 0 0 0",
            }}
          >
            {exercise.name}
          </h3>
        </div>

        {/* Stats : sets × reps + repos */}
        <div className="grid grid-cols-2 gap-2">
          <div
            style={{
              padding: 8,
              textAlign: "center",
              background: "var(--gold-tint-08)",
              border: "1px solid var(--gold-tint-25)",
              clipPath:
                "polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)",
            }}
          >
            <span className="eyebrow" style={{ color: "var(--gold-400)" }}>
              Volume
            </span>
            <div
              className="mono tabular-nums"
              style={{ fontSize: 14, fontWeight: 700, color: "var(--fg-1)", marginTop: 2 }}
            >
              {exercise.sets} × {exercise.reps}
            </div>
          </div>
          {exercise.restSeconds !== undefined && (
            <div
              style={{
                padding: 8,
                textAlign: "center",
                background: "var(--glass-bg-2)",
                border: "1px solid var(--glass-border)",
                clipPath:
                  "polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)",
              }}
            >
              <span
                className="eyebrow flex items-center justify-center gap-1"
                style={{ color: "var(--fg-4)" }}
              >
                <Timer className="h-3 w-3" aria-hidden="true" /> Repos
              </span>
              <div
                className="mono tabular-nums"
                style={{ fontSize: 14, fontWeight: 700, color: "var(--fg-2)", marginTop: 2 }}
              >
                {exercise.restSeconds}
                <span style={{ fontSize: 9, color: "var(--fg-5)", marginLeft: 2 }}>s</span>
              </div>
            </div>
          )}
        </div>

        {onLogSet && (
          <button
            type="button"
            onClick={onLogSet}
            aria-label={`Logger la série ${currentSet} de ${exercise.name}`}
            className="btn btn-ghost mono mt-auto"
            style={{
              width: "100%",
              fontSize: 10,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "var(--gold-400)",
              borderColor: "var(--gold-tint-35)",
            }}
          >
            Logger série {currentSet}
          </button>
        )}
      </div>
    </HudCard>
  );
}

function ExercisePlaceholder({ name }: { name: string }) {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 flex items-center justify-center"
      style={{
        background:
          "linear-gradient(135deg, var(--ink-900) 0%, var(--glass-bg-2) 50%, var(--gold-tint-08) 100%)",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: 44,
          fontWeight: 900,
          color: "var(--gold-400)",
          opacity: 0.2,
          textShadow: "0 0 20px var(--gold-tint-25)",
          userSelect: "none",
        }}
      >
        {name.charAt(0).toUpperCase()}
      </span>
      <div
        className="absolute inset-x-6 bottom-3 h-px"
        style={{
          background:
            "linear-gradient(to right, transparent, var(--gold-tint-35), transparent)",
        }}
      />
    </div>
  );
}
