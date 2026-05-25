import * as React from "react";

/**
 * NoDream Logo — composant SVG inline pour usage UI (TopBar, footer, splash).
 *
 * Inspiré du logo généré par Stitch (frame hexagonal gold + N) tout en
 * préservant la ligne or signature du monogramme ND existant (cf
 * public/icons/icon-source.png).
 *
 * Pour les usages PWA / favicon / Apple Touch icon, utiliser les PNG
 * pré-générés dans public/icons/icon-*.png.
 */

type LogoVariant = "full" | "icon" | "wordmark";
type LogoSize = "sm" | "md" | "lg";

const ICON_SIZE: Record<LogoSize, number> = {
  sm: 28,
  md: 36,
  lg: 56,
};

const TEXT_CLASS: Record<LogoSize, string> = {
  sm: "text-lg",
  md: "text-xl",
  lg: "text-3xl",
};

interface LogoProps {
  variant?: LogoVariant;
  size?: LogoSize;
  /** classes additionnelles sur le wrapper */
  className?: string;
  /** override couleur de l'icône (par défaut gold #d4a017) */
  iconColor?: string;
  /** override couleur du wordmark (par défaut text-primary) */
  textColor?: string;
}

export function Logo({
  variant = "full",
  size = "md",
  className = "",
  iconColor = "#d4a017",
  textColor = "text-primary",
}: LogoProps) {
  const iconPx = ICON_SIZE[size];

  return (
    <span
      className={`inline-flex items-center gap-2 select-none ${className}`}
      aria-label="NoDream"
    >
      {variant !== "wordmark" && (
        <LogoIcon size={iconPx} color={iconColor} aria-hidden={true} />
      )}
      {variant !== "icon" && (
        <span
          className={`font-serif font-extrabold tracking-tight ${TEXT_CLASS[size]} ${textColor}`}
        >
          NoDream
        </span>
      )}
    </span>
  );
}

interface LogoIconProps {
  size?: number;
  color?: string;
  "aria-hidden"?: boolean;
}

/**
 * Juste l'icône — hexagone gold avec N blanc à l'intérieur + ligne gold
 * signature au-dessus (référence au monogramme ND original).
 */
export function LogoIcon({
  size = 36,
  color = "#d4a017",
  "aria-hidden": ariaHidden = true,
}: LogoIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      aria-hidden={ariaHidden}
    >
      {/* Frame hexagonal gold (inspiré Stitch) */}
      <path
        d="M20 3 L34 11 L34 29 L20 37 L6 29 L6 11 Z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Ligne or signature au-dessus du N (référence monogramme ND existant) */}
      <line
        x1="13"
        y1="13"
        x2="27"
        y2="13"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      {/* N letter — géométrique blanc */}
      <path
        d="M13.5 16 L13.5 28 L16 28 L16 20.5 L23.5 28 L26 28 L26 16 L23.5 16 L23.5 23.5 L16 16 Z"
        fill="#fafafa"
      />
    </svg>
  );
}
