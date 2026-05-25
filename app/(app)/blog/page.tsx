import Link from "next/link";
import type { Metadata } from "next";
import { getAllArticles } from "@/content/blog/articles";

export const metadata: Metadata = {
  title: "Blog — NoDream",
  description:
    "Articles factuels sur la sèche, la recomposition corporelle, la nutrition sportive evidence-based. Sans bullshit, sans promesse facile.",
};

export default function BlogIndexPage() {
  const articles = getAllArticles();

  return (
    <main className="flex-1 px-4 py-8 max-w-2xl mx-auto w-full">
      <header className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-serif font-bold text-primary">
          Le journal
        </h1>
        <p className="mt-2 text-sm text-muted-foreground italic">
          Articles factuels. Pas de bullshit. Sources citées.
        </p>
      </header>

      <ul className="space-y-6">
        {articles.map((a) => (
          <li
            key={a.slug}
            className="border-b border-border pb-6 last:border-b-0"
          >
            <Link
              href={`/blog/${a.slug}`}
              className="group block space-y-2"
            >
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="uppercase tracking-wider font-semibold">
                  {a.category}
                </span>
                <span>·</span>
                <time dateTime={a.date}>
                  {new Date(a.date).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </time>
                <span>·</span>
                <span>{a.read_minutes} min</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-serif font-bold text-foreground group-hover:text-primary transition-colors">
                {a.title}
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {a.excerpt}
              </p>
              {a.citations && a.citations.length > 0 && (
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Source : {a.citations.join(", ")}
                </p>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
