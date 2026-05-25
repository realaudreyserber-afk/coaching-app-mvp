"use client";

import * as React from "react";
import { MagazinePhoto } from "@/components/ui/magazine-photo";
import { Logo } from "@/components/branding/logo";

/**
 * Onboarding Layout — split 50/50 sur desktop (photo éditoriale gauche +
 * contenu droite), stacked sur mobile (photo réduite en haut, contenu en
 * dessous).
 *
 * Stitch refs : onboarding-redesign-d.jpg, morphometrics-d.jpg,
 * training-level-d.jpg
 */

interface OnboardingLayoutProps {
  /** Source de la photo éditoriale N&B (placée à gauche desktop, en haut mobile) */
  photoSrc: string;
  /** Alt de la photo */
  photoAlt: string;
  /** Slot droite (titre + form + actions) */
  children: React.ReactNode;
  /** Optionnel : zone fixe en haut à droite (step indicator) */
  headerRight?: React.ReactNode;
}

export function OnboardingLayout({
  photoSrc,
  photoAlt,
  children,
  headerRight,
}: OnboardingLayoutProps) {
  return (
    <div className="relative min-h-screen bg-zinc-950 grid lg:grid-cols-2">
      {/* Logo en haut à gauche (sur la photo en desktop, séparé en mobile) */}
      <div className="absolute top-4 left-4 lg:top-6 lg:left-6 z-10">
        <Logo variant="full" size="md" textColor="text-zinc-50" />
      </div>

      {/* Photo éditoriale — full width mobile (h-64), 50% desktop (full height) */}
      <div className="relative h-64 sm:h-80 lg:h-screen lg:sticky lg:top-0">
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
        {/* Gradient fade vers le bas en mobile pour transition douce vers contenu */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-zinc-950 to-transparent lg:hidden"
        />
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
