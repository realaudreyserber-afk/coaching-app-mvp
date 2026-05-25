import * as React from "react";

/**
 * Loader global NoDream — cercle gold + texte FR.
 * Inspiré du loading screen Stitch (loading-d.jpg).
 *
 * Remplace les spinners inline dispersés dans les pages.
 */

type LoaderSize = "sm" | "md" | "lg" | "fullscreen";

const SIZE_PX: Record<Exclude<LoaderSize, "fullscreen">, number> = {
  sm: 24,
  md: 40,
  lg: 56,
};

interface LoaderProps {
  /** Message affiché sous le cercle (uniquement en mode fullscreen ou si message= défini) */
  message?: string;
  /** Taille du loader. `fullscreen` centre le loader sur tout l'écran avec bg noir */
  size?: LoaderSize;
  className?: string;
}

export function Loader({
  message,
  size = "md",
  className = "",
}: LoaderProps) {
  if (size === "fullscreen") {
    return (
      <div
        role="status"
        aria-live="polite"
        className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-zinc-950 gap-6 ${className}`}
      >
        <Spinner size={56} />
        {message && (
          <p className="text-amber-500 font-serif text-sm tracking-wide">
            {message}
          </p>
        )}
        {!message && <span className="sr-only">Chargement en cours</span>}
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`inline-flex flex-col items-center justify-center gap-3 ${className}`}
    >
      <Spinner size={SIZE_PX[size]} />
      {message && (
        <p className="text-amber-500/80 font-serif text-xs tracking-wide">
          {message}
        </p>
      )}
      {!message && <span className="sr-only">Chargement</span>}
    </div>
  );
}

function Spinner({ size }: { size: number }) {
  return (
    <div
      className="rounded-full border-2 border-amber-500 border-t-transparent animate-spin"
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}
