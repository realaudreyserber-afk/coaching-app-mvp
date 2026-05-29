import { describe, it, expect, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { searchExercises, exerciseCount } from './index';

describe('exercise-db (Functional Fitness v2.9)', () => {
  it('charge la bibliothèque (> 3000 exercices)', () => {
    expect(exerciseCount()).toBeGreaterThan(3000);
  });

  it('filtre par niveau (inclut le niveau ET en dessous)', () => {
    const deb = searchExercises({ maxLevel: 'debutant' }, 50);
    expect(deb.length).toBeGreaterThan(0);
    expect(deb.every((e) => e.level === 'debutant')).toBe(true);

    const inter = searchExercises({ maxLevel: 'intermediaire' }, 200);
    expect(inter.some((e) => e.level === 'debutant')).toBe(true);
    expect(inter.every((e) => e.level !== 'avance')).toBe(true);
  });

  it('filtre par muscle', () => {
    const glutes = searchExercises({ muscle: 'fessiers' }, 30);
    expect(glutes.length).toBeGreaterThan(0);
    expect(glutes.every((e) => e.muscle === 'fessiers')).toBe(true);
  });

  it('équipement : poids du corps ("aucun") toujours autorisé', () => {
    const homeBw = searchExercises({ equipment: ['elastique'], muscle: 'abdominaux' }, 30);
    // ne doit contenir que aucun OU elastique
    expect(homeBw.every((e) => e.equipment === 'aucun' || e.equipment === 'elastique')).toBe(true);
  });

  it('exercices ont un nom FR + niveau valide', () => {
    const s = searchExercises({}, 20);
    for (const e of s) {
      expect(e.name_fr.length).toBeGreaterThan(0);
      expect(['debutant', 'intermediaire', 'avance']).toContain(e.level);
    }
  });

  it('filtre par famille (push/pull/squat/hinge/core/autres)', () => {
    const squat = searchExercises({ family: 'squat' }, 20);
    expect(squat.length).toBeGreaterThan(0);
    expect(squat.every((e) => e.family === 'squat')).toBe(true);
  });

  it('expose des liens démo vidéo (demo_url)', () => {
    const withDemo = searchExercises({}, 200).filter((e) => e.demo_url);
    expect(withDemo.length).toBeGreaterThan(0);
    expect(withDemo[0].demo_url).toMatch(/^https?:\/\//);
  });
});
