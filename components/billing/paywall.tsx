"use client";

/**
 * Paywall — écran de fin d'essai (modèle "14 j gratuits → abonnement").
 *
 * Affiché par le layout (app) à la place du contenu quand l'accès est `locked`
 * ET que le paywall est activé (NEXT_PUBLIC_ENABLE_PAYWALL=1). Les Réglages +
 * l'export/suppression RGPD restent accessibles (cf. allowlist du layout) pour
 * pouvoir payer ou exercer ses droits.
 */

import * as React from "react";
import Link from "next/link";
import { BrandMark } from "@/components/nodream";
import { Crown, Lock } from "lucide-react";

export function Paywall() {
  return (
    <main
      className="flex-1 flex items-center justify-center px-4 py-12"
      style={{ position: "relative", zIndex: 1 }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 460,
          background: "var(--glass-bg-3)",
          border: "1px solid var(--gold-tint-35)",
          boxShadow: "0 0 40px var(--gold-tint-15)",
          padding: "28px 24px",
          textAlign: "center",
          clipPath:
            "polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px))",
        }}
      >
        <div className="flex justify-center mb-4">
          <BrandMark size={44} />
        </div>

        <span
          className="mono inline-flex items-center gap-1.5"
          style={{ fontSize: 10, letterSpacing: "0.3em", color: "var(--gold-400)", textTransform: "uppercase" }}
        >
          <Lock className="w-3 h-3" /> Essai terminé
        </span>

        <h1
          style={{
            fontFamily: "var(--font-sans)",
            fontWeight: 900,
            fontSize: 26,
            color: "var(--fg-1)",
            margin: "12px 0 8px",
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
          }}
        >
          Continue avec <span style={{ color: "var(--gold-400)" }}>Premium</span>
        </h1>

        <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--fg-3)", margin: "0 auto 22px", maxWidth: 360 }}>
          Ton essai de 14 jours est terminé. Passe à Premium pour garder ton
          coach IA, ton plan et ton suivi complet — calibrés sur tes vraies données.
          {/* Prix affiché sur la page abonnement (source unique = Price Stripe). */}
        </p>

        <Link
          href="/settings/subscription"
          className="btn btn-primary mono"
          style={{
            width: "100%",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            fontSize: 13,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            padding: "14px",
          }}
        >
          <Crown className="w-4 h-4" /> Passer à Premium
        </Link>

        <p className="mono" style={{ fontSize: 10, color: "var(--fg-5)", marginTop: 16, letterSpacing: "0.05em" }}>
          Résiliable à tout moment ·{" "}
          <Link href="/settings/privacy" style={{ color: "var(--fg-4)", textDecoration: "underline" }}>
            Exporter / supprimer mes données
          </Link>
        </p>
      </div>
    </main>
  );
}
