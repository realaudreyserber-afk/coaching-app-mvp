import Link from "next/link";
import type { Metadata } from "next";
import Image from "next/image";
import { getAllArticles } from "@/content/blog/articles";

export const metadata: Metadata = {
  title: "Le journal — NoDream",
  description:
    "Articles factuels sur la sèche, la recomposition corporelle, la nutrition sportive evidence-based. Sans bullshit, sans promesse facile.",
};

export default function BlogIndexPage() {
  const articles = getAllArticles();
  const [featured, ...rest] = articles;

  return (
    <main className="nd-scope flex-1 min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        {/* Editorial header */}
        <header className="mb-16 nd-fade-up">
          <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-[--color-nd-gold] mb-4">
            <div className="h-px w-8 bg-[--color-nd-gold]" />
            <span className="font-semibold">Le journal</span>
          </div>
          <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.05] tracking-tight text-[--color-nd-white]">
            Pas de rêve.<br />
            <span className="text-[--color-nd-gold]">Des résultats.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base sm:text-lg text-[--color-nd-white-dim] leading-relaxed">
            Articles factuels sur la recomposition corporelle, la sèche
            et la nutrition sportive. Sources peer-reviewed citées. Pas
            d&apos;influenceur, pas de code promo.
          </p>
        </header>

        {/* Featured article — hero card */}
        {featured && (
          <Link
            href={`/blog/${featured.slug}`}
            className="group block mb-16 nd-fade-up nd-stagger-1"
          >
            <article className="grid lg:grid-cols-[1.2fr_1fr] gap-6 lg:gap-10 items-center">
              <div className="relative aspect-[4/3] lg:aspect-[5/4] overflow-hidden rounded-sm bg-[--color-nd-black-soft] border border-[--color-nd-stroke]">
                {featured.hero_image ? (
                  <Image
                    src={featured.hero_image}
                    alt={featured.hero_alt ?? featured.title}
                    fill
                    sizes="(min-width: 1024px) 60vw, 100vw"
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                  />
                ) : (
                  <HeroPlaceholder seed={featured.slug} />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[--color-nd-black]/80 via-transparent to-transparent" />
                <div className="absolute top-4 left-4">
                  <span className="inline-block bg-[--color-nd-gold] text-[--color-nd-black] text-[10px] uppercase tracking-widest font-bold px-3 py-1.5">
                    À la une
                  </span>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-[--color-nd-muted]">
                  <span className="text-[--color-nd-gold] font-semibold">
                    {featured.category}
                  </span>
                  <span>·</span>
                  <time dateTime={featured.date}>
                    {new Date(featured.date).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </time>
                  <span>·</span>
                  <span>{featured.read_minutes} min</span>
                </div>
                <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold leading-[1.1] text-[--color-nd-white] group-hover:text-[--color-nd-gold] transition-colors duration-300">
                  {featured.title}
                </h2>
                <p className="text-base sm:text-lg text-[--color-nd-white-dim] leading-relaxed">
                  {featured.excerpt}
                </p>
                {featured.citations && featured.citations.length > 0 && (
                  <p className="text-[11px] uppercase tracking-widest text-[--color-nd-muted]">
                    Source · {featured.citations.join(" · ")}
                  </p>
                )}
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-[--color-nd-gold] pt-2">
                  Lire l&apos;article
                  <span className="inline-block transition-transform group-hover:translate-x-1">
                    →
                  </span>
                </span>
              </div>
            </article>
          </Link>
        )}

        {/* Grid of remaining articles */}
        {rest.length > 0 && (
          <>
            <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-[--color-nd-muted] mb-8 nd-fade-up nd-stagger-2">
              <div className="h-px w-8 bg-[--color-nd-stroke]" />
              <span>Tous les articles</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-6 lg:gap-10">
              {rest.map((a, idx) => (
                <Link
                  key={a.slug}
                  href={`/blog/${a.slug}`}
                  className={`group block nd-fade-up nd-stagger-${Math.min(idx + 3, 5)}`}
                >
                  <article className="space-y-4">
                    <div className="relative aspect-[4/3] overflow-hidden rounded-sm bg-[--color-nd-black-soft] border border-[--color-nd-stroke]">
                      {a.hero_image ? (
                        <Image
                          src={a.hero_image}
                          alt={a.hero_alt ?? a.title}
                          fill
                          sizes="(min-width: 1024px) 40vw, (min-width: 640px) 50vw, 100vw"
                          className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                        />
                      ) : (
                        <HeroPlaceholder seed={a.slug} />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-[--color-nd-black]/60 via-transparent to-transparent" />
                    </div>
                    <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.18em] text-[--color-nd-muted]">
                      <span className="text-[--color-nd-gold] font-semibold">
                        {a.category}
                      </span>
                      <span>·</span>
                      <span>{a.read_minutes} min</span>
                    </div>
                    <h3 className="font-serif text-xl sm:text-2xl font-bold leading-tight text-[--color-nd-white] group-hover:text-[--color-nd-gold] transition-colors">
                      {a.title}
                    </h3>
                    <p className="text-sm text-[--color-nd-white-dim] leading-relaxed line-clamp-3">
                      {a.excerpt}
                    </p>
                  </article>
                </Link>
              ))}
            </div>
          </>
        )}

        <footer className="mt-20 pt-10 border-t border-[--color-nd-stroke] text-center nd-fade-in nd-stagger-5">
          <p className="text-xs text-[--color-nd-muted] uppercase tracking-[0.2em]">
            NoDream · Coaching IA sans illusion
          </p>
        </footer>
      </div>
    </main>
  );
}

/**
 * Geometric fallback shown when hero_image is missing.
 * Generates a deterministic gradient + monogram from the article slug.
 */
function HeroPlaceholder({ seed }: { seed: string }) {
  const hue =
    seed.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  const initial = seed[0]?.toUpperCase() ?? "N";
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{
        background: `linear-gradient(135deg, hsl(${hue}, 18%, 12%), #0a0a0a 70%)`,
      }}
    >
      <span className="font-serif text-7xl font-bold text-[--color-nd-gold] opacity-30">
        {initial}
      </span>
    </div>
  );
}
