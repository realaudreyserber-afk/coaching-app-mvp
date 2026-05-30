import { getExercisesFrLite, exerciseFrCategories, exerciseFrCount } from '@/lib/features/exercises-fr';
import { ExercisesBrowser } from './browser';

export const metadata = {
  title: 'Exercices de musculation',
  description: 'Bibliothèque d’exercices : muscle ciblé, image et exécution pas à pas.',
};

export default function ExercicesMusculationPage() {
  const exercises = getExercisesFrLite();
  const categories = exerciseFrCategories();

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10 space-y-8">
      <header>
        <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-amber-500 mb-3">
          <div className="h-px w-8 bg-amber-500" aria-hidden="true" />
          <span className="font-semibold">Bibliothèque</span>
        </div>
        <h1 className="text-3xl lg:text-5xl font-bold font-serif text-zinc-50">
          Exercices de <span className="text-amber-400">musculation</span>
        </h1>
        <p className="mt-3 text-base text-zinc-400 max-w-2xl">
          {exerciseFrCount()} exercices : muscle ciblé, image et exécution pas à pas.
          Filtre par groupe musculaire ou cherche un mouvement précis.
        </p>
      </header>

      <ExercisesBrowser exercises={exercises} categories={categories} />
    </div>
  );
}
