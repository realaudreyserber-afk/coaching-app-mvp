import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getExerciseFrBySlug } from '@/lib/features/exercises-fr';

export default async function ExerciseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ex = getExerciseFrBySlug(slug);
  if (!ex) notFound();

  return (
    <div className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-6 lg:py-10 space-y-6">
      <Link
        href="/exercices-musculation"
        className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-amber-400 transition-colors"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
          arrow_back
        </span>
        Tous les exercices
      </Link>

      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-amber-500 font-semibold mb-2">
          {ex.category}
        </p>
        <h1 className="text-2xl lg:text-4xl font-bold font-serif text-zinc-50">{ex.name}</h1>
        {ex.meta_description && (
          <p className="mt-3 text-base text-zinc-400">{ex.meta_description}</p>
        )}
      </header>

      {ex.image && (
        <div className="rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900/40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ex.image} alt={ex.name} className="w-full object-cover" />
        </div>
      )}

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-bold text-zinc-100">
          <span className="material-symbols-outlined text-amber-400">checklist</span>
          Comment faire
        </h2>
        <p className="text-zinc-300 leading-relaxed whitespace-pre-line">{ex.how_to}</p>
      </section>

      <footer className="pt-4 border-t border-zinc-800">
        <a
          href={ex.url}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-zinc-500 hover:text-amber-400 transition-colors"
        >
          Source : docteur-fitness.com ↗
        </a>
      </footer>
    </div>
  );
}
