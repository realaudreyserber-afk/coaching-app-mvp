import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { MarkdownLight } from "@/components/coach/markdown-light";
import { AccentChart } from "@/components/blog/accent-charts";
import { getArticle, getAllArticles } from "@/content/blog/articles";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllArticles().map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) return { title: "Article introuvable — NoDream" };
  return {
    title: `${article.title} — NoDream`,
    description: article.excerpt,
    openGraph: {
      title: article.title,
      description: article.excerpt,
      images: article.hero_image ? [article.hero_image] : [],
    },
  };
}

export default async function ArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

  // Split body in two parts around the chart anchor "{{CHART}}", or
  // just render the chart after the 3rd block if no anchor is provided.
  const blocks = article.body.split(/\n\n+/);
  const chartInsertAt = Math.min(3, Math.max(1, Math.floor(blocks.length / 3)));
  const bodyBefore = blocks.slice(0, chartInsertAt).join("\n\n");
  const bodyAfter = blocks.slice(chartInsertAt).join("\n\n");

  return (
    <main className="nd-scope flex-1 min-h-screen">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        {/* Back link */}
        <div className="nd-fade-in">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[--color-nd-muted] hover:text-[--color-nd-gold] mb-10 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Retour au journal
          </Link>
        </div>

        <article className="space-y-10">
          {/* Header */}
          <header className="space-y-5 nd-fade-up">
            <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.2em] text-[--color-nd-muted]">
              <span className="text-[--color-nd-gold] font-semibold">
                {article.category}
              </span>
              <span>·</span>
              <time dateTime={article.date}>
                {new Date(article.date).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </time>
              <span>·</span>
              <span>{article.read_minutes} min</span>
            </div>
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-tight text-[--color-nd-white]">
              {article.title}
            </h1>
            <p className="text-lg sm:text-xl text-[--color-nd-white-dim] leading-relaxed font-serif italic">
              {article.excerpt}
            </p>
          </header>

          {/* Hero image */}
          {article.hero_image && (
            <div className="relative aspect-[16/9] overflow-hidden rounded-sm bg-[--color-nd-black-soft] border border-[--color-nd-stroke] nd-fade-up nd-stagger-1">
              <Image
                src={article.hero_image}
                alt={article.hero_alt ?? article.title}
                fill
                sizes="(min-width: 1024px) 768px, 100vw"
                priority
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[--color-nd-black]/40 via-transparent to-transparent pointer-events-none" />
            </div>
          )}

          {/* Body part 1 */}
          <div className="article-body font-serif text-lg leading-relaxed text-[--color-nd-white] nd-fade-up nd-stagger-2">
            <MarkdownLight text={bodyBefore} />
          </div>

          {/* Accent chart inserted mid-article */}
          {article.accent_chart && (
            <div className="nd-fade-up nd-stagger-3">
              <AccentChart kind={article.accent_chart} />
            </div>
          )}

          {/* Body part 2 */}
          <div className="article-body font-serif text-lg leading-relaxed text-[--color-nd-white] nd-fade-up nd-stagger-3">
            <MarkdownLight text={bodyAfter} />
          </div>

          {/* Sources footer */}
          {article.citations && article.citations.length > 0 && (
            <footer className="mt-16 pt-8 border-t border-[--color-nd-stroke] nd-fade-in nd-stagger-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-[--color-nd-gold] font-bold mb-4">
                Sources scientifiques
              </p>
              <ul className="space-y-2 text-sm text-[--color-nd-white-dim]">
                {article.citations.map((c) => (
                  <li key={c} className="flex items-start gap-3">
                    <span className="text-[--color-nd-gold] mt-1">·</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-xs text-[--color-nd-muted] italic">
                Tu veux la référence complète (DOI, journal, méthodologie) ?
                Pose la question au coach IA dans l&apos;app, il a accès au
                corpus.
              </p>
            </footer>
          )}
        </article>

        {/* Next/back nav */}
        <nav className="mt-20 pt-10 border-t border-[--color-nd-stroke] nd-fade-in nd-stagger-5">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-sm text-[--color-nd-gold] hover:text-[--color-nd-gold-glow] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Voir tous les articles
          </Link>
        </nav>
      </div>
    </main>
  );
}
