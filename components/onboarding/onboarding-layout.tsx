"use client";

import * as React from "react";
import { MagazinePhoto } from "@/components/ui/magazine-photo";
import { BrandMark, Wordmark } from "@/components/nodream";

// Wordmark wraps BrandMark internally; we use BrandMark alone on mobile and Wordmark on desktop.

/**
 * Onboarding Layout — NoDream Tactical OS.
 * Split 50/50 sur desktop (photo éditoriale gauche + contenu droite),
 * stacked sur mobile. Le fond globale Matrix rain reste visible via
 * transparent backgrounds.
 */

interface OnboardingLayoutProps {
  photoSrc: string;
  photoAlt: string;
  children: React.ReactNode;
  headerRight?: React.ReactNode;
}

export function OnboardingLayout({
  photoSrc,
  photoAlt,
  children,
  headerRight,
}: OnboardingLayoutProps) {
  return (
    <div
      className="relative min-h-screen grid lg:grid-cols-2"
      style={{ background: "transparent" }}
    >
      {/* BrandMark tactical en haut à gauche */}
      <div className="absolute top-4 left-4 lg:top-6 lg:left-6 z-10">
        <div className="sm:hidden">
          <BrandMark size={32} />
        </div>
        <div className="hidden sm:block">
          <Wordmark />
        </div>
      </div>

      {/* Photo éditoriale — full width mobile (h-64), 50% desktop (full height) */}
      <div
        className="relative h-64 sm:h-80 lg:h-screen lg:sticky lg:top-0"
        style={{ borderRight: "1px solid var(--gold-tint-15)" }}
      >
        <MagazinePhoto
          src={photoSrc}
          alt={photoAlt}
          fill
          sizes="(max-width: 1024px) 100vw, 50vw"
          priority
          grayscale
          goldAccent
          className="object-cover"
          wrapperClassName="absolute inset-0"
        />
        {/* Gradient fade vers le bas en mobile + 4 corners éditoriaux desktop */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-24 lg:hidden"
          style={{
            background:
              "linear-gradient(to top, var(--ink-900), transparent)",
          }}
        />
        {/* Overlay tactical : eyebrow [PROTO-INIT] en bas gauche */}
        <div
          className="absolute bottom-4 left-4 lg:bottom-6 lg:left-6 z-10 mono"
          style={{
            fontSize: 10,
            letterSpacing: "0.3em",
            color: "var(--accent-tech)",
            opacity: 0.85,
            textTransform: "uppercase",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 10px",
            background: "rgba(6, 3, 15, 0.7)",
            border: "1px solid var(--accent-tech-tint)",
            clipPath:
              "polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)",
          }}
        >
          <span className="status-dot" aria-hidden="true" />
          [PROTO-INIT] · CALIBRATION
        </div>
      </div>

      {/* Contenu — full width mobile, 50% desktop */}
      <div className="relative flex flex-col px-6 py-8 sm:px-10 lg:px-16 lg:py-12">
        {headerRight && (
          <div className="absolute top-6 right-6 lg:top-8 lg:right-12">
            {headerRight}
          </div>
        )}
        <div className="flex-1 flex flex-col justify-center max-w-xl mx-auto w-full">
          {children}
        </div>
      </div>
    </div>
  );
}
