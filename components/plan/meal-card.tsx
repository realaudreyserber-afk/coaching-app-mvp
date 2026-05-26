"use client";

import * as React from "react";
import Image from "next/image";
import { Pill } from "lucide-react";
import { HudCard, Tag } from "@/components/nodream";

/**
 * Meal Card — NoDream Tactical OS.
 * Glass HudCard avec accent gold, corners brackets, photo full-bleed
 * recouverte par overlay, badge kcal en stat-num gold, macros en mono tag,
 * compléments en mono chamfered tech.
 */

/**
 * Wave 11A — Structured ingredient row passed to MealCard.
 * Matches PlanMealItem from types/plan.ts but copied here to keep the
 * component standalone (avoids cyclic imports + lets callers use this
 * card without depending on the full plan type).
 */
export interface MealCardItem {
  food: string;
  grams: number;
  state?: 'cru' | 'cuit';
  kcal: number;
  p: number;
  c: number;
  f: number;
}

export interface MealCardData {
  name: string;
  description?: string;
  approxKcal?: number;
  macros?: { p?: number; c?: number; f?: number };
  photoUrl?: string;
  supplements?: Array<{ name: string; dosage: string }>;
  /**
   * Wave 11A — Detailed ingredient breakdown from the IA-generated plan.
   * When present, rendered as a list with grammage + per-item kcal — this
   * is the format the user explicitly asked for. When absent, falls back
   * to the free-text `description` (back-compat with old plans).
   */
  items?: MealCardItem[];
}

interface MealCardProps {
  meal: MealCardData;
  onAdd?: () => void;
  ctaLabel?: string;
  className?: string;
}

export function MealCard({
  meal,
  onAdd,
  ctaLabel = "Ajouter",
  className = "",
}: MealCardProps) {
  return (
    <HudCard
      accent="gold"
      chamfer="sm"
      className={`group overflow-hidden ${className}`}
      style={{ padding: 0, display: "flex", flexDirection: "column" }}
    >
      {/* Photo or placeholder */}
      <div
        className="relative aspect-[4/3] overflow-hidden"
        style={{
          background: "var(--ink-900)",
          borderBottom: "1px solid var(--gold-tint-15)",
        }}
      >
        {meal.photoUrl ? (
          <Image
            src={meal.photoUrl}
            alt={meal.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            style={{ filter: "grayscale(0.2) contrast(1.05)" }}
          />
        ) : (
          <MealPhotoPlaceholder name={meal.name} />
        )}
        {/* Bottom gradient + kcal badge */}
        {meal.approxKcal !== undefined && (
          <>
            <div
              aria-hidden="true"
              className="absolute inset-x-0 bottom-0 h-16"
              style={{ background: "linear-gradient(to top, var(--ink-900), transparent)" }}
            />
            <span
              className="absolute bottom-2 right-2 mono"
              style={{
                padding: "3px 9px",
                background: "rgba(6, 3, 15, 0.85)",
                color: "var(--gold-400)",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.05em",
                border: "1px solid var(--gold-tint-35)",
                boxShadow: "var(--glow-gold-soft)",
                clipPath:
                  "polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)",
              }}
            >
              ~{meal.approxKcal} kcal
            </span>
          </>
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
            [REPAS]
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
            {meal.name}
          </h3>
        </div>

        {/* Wave 11A — Show structured items[] when the IA gave us details,
            fall back to the description text otherwise (legacy plans). */}
        {meal.items && meal.items.length > 0 ? (
          <ul
            style={{ margin: 0, padding: 0, listStyle: "none" }}
            aria-label="Composition du repas avec grammages"
          >
            {meal.items.map((item, idx) => (
              <li
                key={idx}
                className="flex justify-between items-baseline gap-2"
                style={{
                  padding: "5px 0",
                  fontSize: 11,
                  borderBottom:
                    idx < meal.items!.length - 1
                      ? "1px dashed var(--glass-border)"
                      : "none",
                }}
              >
                <span style={{ color: "var(--fg-2)", flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 600 }}>{item.food}</span>
                  <span
                    className="mono"
                    style={{
                      fontSize: 9,
                      color: "var(--fg-5)",
                      marginLeft: 6,
                      letterSpacing: "0.05em",
                    }}
                  >
                    {item.grams}g
                    {item.state === "cuit" ? " cuit" : ""}
                  </span>
                </span>
                <span
                  className="mono"
                  style={{
                    fontSize: 10,
                    color: "var(--gold-400)",
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                    letterSpacing: "0.05em",
                  }}
                >
                  {item.kcal} kcal
                </span>
              </li>
            ))}
          </ul>
        ) : (
          meal.description && (
            <p
              style={{
                fontSize: 11,
                color: "var(--fg-4)",
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              {meal.description}
            </p>
          )
        )}

        {/* Macros */}
        {meal.macros && (
          <div className="grid grid-cols-3 gap-1.5">
            {([
              { letter: "P", val: meal.macros.p },
              { letter: "C", val: meal.macros.c },
              { letter: "F", val: meal.macros.f },
            ]).filter((m) => m.val !== undefined).map((m) => (
              <div
                key={m.letter}
                className="text-center"
                style={{
                  padding: 6,
                  background: "var(--glass-bg-2)",
                  border: "1px solid var(--glass-border)",
                  clipPath:
                    "polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)",
                }}
              >
                <span className="eyebrow" style={{ color: "var(--fg-4)", fontSize: 8 }}>
                  {m.letter}
                </span>
                <div
                  className="mono"
                  style={{ fontSize: 12, fontWeight: 700, color: "var(--fg-1)", marginTop: 2 }}
                >
                  {m.val}
                  <span style={{ fontSize: 8, color: "var(--fg-5)", marginLeft: 1 }}>g</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Supplements list */}
        {meal.supplements && meal.supplements.length > 0 && (
          <div className="pt-2 space-y-1.5" style={{ borderTop: "1px solid var(--glass-border)" }}>
            <span
              className="mono flex items-center gap-1.5"
              style={{
                fontSize: 9,
                letterSpacing: "0.25em",
                color: "var(--accent-tech)",
                textTransform: "uppercase",
                fontWeight: 700,
              }}
            >
              <Pill className="h-3 w-3" aria-hidden="true" />
              [SUPP-{meal.supplements.length}]
            </span>
            <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {meal.supplements.map((sup, idx) => (
                <li
                  key={idx}
                  className="flex justify-between items-center"
                  style={{ padding: "4px 0", fontSize: 11 }}
                >
                  <span style={{ color: "var(--fg-2)", fontWeight: 500 }}>{sup.name}</span>
                  <span
                    className="mono"
                    style={{
                      color: "var(--accent-tech)",
                      fontWeight: 700,
                      fontSize: 10,
                      letterSpacing: "0.05em",
                    }}
                  >
                    {sup.dosage}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* CTA */}
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            aria-label={`${ctaLabel} : ${meal.name}`}
            className="btn btn-primary mono mt-auto"
            style={{
              width: "100%",
              fontSize: 11,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
            }}
          >
            {ctaLabel}
          </button>
        )}
      </div>
    </HudCard>
  );
}

// Silence the unused-import linter — Tag stays available for future variants
void Tag;

function MealPhotoPlaceholder({ name }: { name: string }) {
  const initial = name.replace(/^[^:]*:\s*/, "").charAt(0).toUpperCase() || "N";
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
          fontSize: 60,
          fontWeight: 900,
          color: "var(--gold-400)",
          opacity: 0.25,
          textShadow: "0 0 30px var(--gold-tint-25)",
          userSelect: "none",
        }}
      >
        {initial}
      </span>
      <div
        className="absolute inset-x-4 bottom-4 h-px"
        style={{
          background:
            "linear-gradient(to right, transparent, var(--gold-tint-35), transparent)",
        }}
      />
    </div>
  );
}
