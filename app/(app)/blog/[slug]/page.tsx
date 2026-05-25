import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { MarkdownLight } from "@/components/coach/markdown-light";
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
  };
}

export default async function ArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

  return (
    <main className="flex-1 px-4 py-8 max-w-2xl mx-auto w-full">
      <Link
        href="/blog"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour au journal
      </Link>

      <article className="space-y-6">
        <header className="space-y-3">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="uppercase tracking-wider font-semibold">
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
            <span>{article.read_minutes} min de lecture</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-serif font-bold text-primary leading-tight">
            {article.title}
          </h1>
          <p className="text-base text-muted-foreground italic leading-relaxed">
            {article.excerpt}
          </p>
        </header>

        <div className="prose prose-sm sm:prose-base max-w-none font-serif text-foreground leading-relaxed">
          <MarkdownLight text={article.body} />
        </div>

        {article.citations && article.citations.length > 0 && (
          <footer className="mt-10 pt-6 border-t border-border">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
              Sources scientifiques
            </p>
            <ul className="text-sm text-foreground/80 space-y-1">
              {article.citations.map((c) => (
                <li key={c}>· {c}</li>
              ))}
            </ul>
          </footer>
        )}
      </article>
    </main>
  );
}
