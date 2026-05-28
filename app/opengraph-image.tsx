import { ImageResponse } from "next/og";

/**
 * OG image dynamique de la landing (NoDream Tactical OS).
 * Détectée automatiquement par Next.js → injectée en og:image / twitter:image
 * sur `/`. Rendue à l'edge via next/og (aucune dépendance externe).
 *
 * Carte de partage social brandée : fond ink, "Des résultats." en gold,
 * wordmark + tagline mono. Format OG standard 1200×630.
 */
export const runtime = "edge";
export const alt = "NoDream · Tactical OS — Pas de rêve. Des résultats.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#06030f";
const GOLD = "#d4af37";
const GOLD_LIGHT = "#ffd700";
const TECH = "#00ff66";
const FG = "#f4f4f5";
const FG_DIM = "#a1a1aa";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: INK,
          backgroundImage:
            "radial-gradient(900px 500px at 85% 15%, rgba(212,175,55,0.16), transparent 60%), radial-gradient(700px 500px at 10% 90%, rgba(0,255,102,0.10), transparent 55%)",
          padding: "64px 72px",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* Cadre tactical */}
        <div
          style={{
            position: "absolute",
            inset: 24,
            border: "1px solid rgba(212,175,55,0.25)",
            display: "flex",
          }}
        />

        {/* Top : tag statut */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 16px",
              border: `1px solid ${TECH}`,
              backgroundColor: "rgba(0,255,102,0.08)",
              color: TECH,
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: 4,
            }}
          >
            ● ORACLE.IA · EN LIGNE
          </div>
        </div>

        {/* Centre : titre */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 104,
              fontWeight: 900,
              color: FG,
              letterSpacing: -3,
              lineHeight: 1.02,
            }}
          >
            Pas de rêve.
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 104,
              fontWeight: 900,
              color: GOLD,
              letterSpacing: -3,
              lineHeight: 1.02,
            }}
          >
            Des résultats.
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 28,
              fontSize: 30,
              color: FG_DIM,
              maxWidth: 760,
              lineHeight: 1.4,
            }}
          >
            Coach IA de recomposition corporelle. Calibré sur tes vraies données, sources citées.
          </div>
        </div>

        {/* Bas : wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 56,
              height: 56,
              border: `2px solid ${GOLD}`,
              borderRadius: 12,
              color: GOLD_LIGHT,
              fontSize: 34,
              fontWeight: 900,
            }}
          >
            N
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 38, fontWeight: 900, color: GOLD, letterSpacing: -1 }}>
              NoDream
            </div>
            <div style={{ display: "flex", fontSize: 16, fontWeight: 700, color: TECH, letterSpacing: 6 }}>
              IA · TACTICAL · OS
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
