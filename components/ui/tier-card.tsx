"use client";

import * as React from "react";
import { CheckCircle, Loader2 } from "lucide-react";

/**
 * Tier Card — carte d'abonnement avec titre, prix, features bullets et CTA.
 * Stitch ref : paywall-d.jpg (3 tiers Libre/Elite/Héritage avec card Recommended highlighted)
 */

interface TierCardProps {
  /** Nom du plan (ex: "Mensuel", "Annuel", "Elite") */
  name: string;
  /** Prix affiché (ex: "9,99 €/mois", "Gratuit") */
  price: string;
  /** Sous-titre (ex: "Sans engagement, résiliable à tout moment") */
  subtitle?: string;
  /** Bullet points des features */
  features?: string[];
  /** Label du bouton CTA */
  ctaLabel: string;
  /** Callback du CTA */
  onCta: () => void;
  /** État de chargement (affiche un spinner dans le bouton) */
  loading?: boolean;
  /** Badge "Recommended" affiché en haut */
  recommended?: boolean;
  /** Variante visuelle CTA */
  ctaVariant?: "primary" | "outline";
  className?: string;
}

export function TierCard({
  name,
  price,
  subtitle,
  features = [],
  ctaLabel,
  onCta,
  loading = false,
  recommended = false,
  ctaVariant = "primary",
  className = "",
}: TierCardProps) {
  return (
    <article
      className={`relative flex flex-col rounded-lg border ${
        recommended
          ? "border-amber-500 bg-zinc-900 shadow-lg shadow-amber-500/10"
          : "border-zinc-800 bg-zinc-900"
      } p-6 ${className}`}
    >
      {recommended && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-amber-500 text-zinc-950 text-[10px] font-bold uppercase tracking-widest">
          Recommandé
        </span>
      )}

      <header className="space-y-2">
        <h3 className="text-xl font-serif font-bold text-zinc-50">{name}</h3>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold font-serif text-amber-400 tabular-nums">
            {price}
          </span>
        </div>
        {subtitle && (
          <p className="text-xs text-zinc-400 leading-relaxed">{subtitle}</p>
        )}
      </header>

      {features.length > 0 && (
        <ul className="mt-6 space-y-2.5 flex-1">
          {features.map((feature, idx) => (
            <li
              key={idx}
              className="flex items-start gap-2 text-sm text-zinc-200"
            >
              <CheckCircle
                className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={onCta}
        disabled={loading}
        aria-label={`${ctaLabel} : ${name}`}
        className={`mt-6 h-11 rounded-md font-semibold text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed ${
          ctaVariant === "primary"
            ? "bg-amber-500 text-zinc-950 hover:bg-amber-400"
            : "bg-transparent border border-zinc-700 text-zinc-100 hover:bg-zinc-800"
        }`}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            <span>Patiente...</span>
          </span>
        ) : (
          ctaLabel
        )}
      </button>
    </article>
  );
}
