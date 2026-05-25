import * as React from "react";
import Image, { ImageProps } from "next/image";

/**
 * Magazine Photo — wrapper next/image avec filtre éditorial N&B optionnel
 * et overlay gold latéral subtil. Utilisé dans Onboarding, Training Level,
 * articles blog.
 *
 * Stitch refs : onboarding-redesign-d.jpg, training-level-d.jpg
 */

interface MagazinePhotoProps extends Omit<ImageProps, "alt"> {
  alt: string;
  /** Active le filtre N&B (default true pour le style éditorial NoDream) */
  grayscale?: boolean;
  /** Overlay gold latéral subtil (default false, à activer pour hero) */
  goldAccent?: boolean;
  /** Classe wrapper */
  wrapperClassName?: string;
}

export function MagazinePhoto({
  alt,
  grayscale = true,
  goldAccent = false,
  wrapperClassName = "",
  className = "",
  ...imageProps
}: MagazinePhotoProps) {
  return (
    <div className={`relative overflow-hidden ${wrapperClassName}`}>
      <Image
        alt={alt}
        className={`${grayscale ? "grayscale" : ""} object-cover ${className}`}
        {...imageProps}
      />
      {goldAccent && (
        <>
          {/* Vertical gold line on the right edge */}
          <div
            aria-hidden="true"
            className="absolute right-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-amber-500 to-transparent opacity-60"
          />
          {/* Subtle warm overlay tint on the right side */}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-l from-amber-500/10 via-transparent to-transparent pointer-events-none"
          />
        </>
      )}
    </div>
  );
}
