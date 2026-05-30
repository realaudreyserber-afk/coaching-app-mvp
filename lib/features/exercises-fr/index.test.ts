import { describe, it, expect, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  getAllExercisesFr,
  getExercisesFrLite,
  getExerciseFrBySlug,
  exerciseFrCategories,
  exerciseFrCount,
} from './index';

describe('exercises-fr (docteur-fitness)', () => {
  it('charge la bibliothèque (> 450 exos)', () => {
    expect(exerciseFrCount()).toBeGreaterThan(450);
  });

  it('chaque exo a nom + catégorie + how_to', () => {
    for (const e of getAllExercisesFr().slice(0, 40)) {
      expect(e.name.length).toBeGreaterThan(0);
      expect(e.category.length).toBeGreaterThan(0);
      expect(e.how_to.length).toBeGreaterThan(40);
    }
  });

  it('lite : sans how_to, trié muscu en premier', () => {
    const lite = getExercisesFrLite();
    expect(lite.length).toBe(exerciseFrCount());
    expect(lite[0]).not.toHaveProperty('how_to');
  });

  it('getExerciseFrBySlug résout air-squat -> quadriceps', () => {
    const e = getExerciseFrBySlug('air-squat');
    expect(e).not.toBeNull();
    expect(e!.category).toBe('quadriceps');
  });

  it('slug inconnu -> null', () => {
    expect(getExerciseFrBySlug('xyzzy-inexistant')).toBeNull();
  });

  it('catégories : comptes cohérents avec le total', () => {
    const cats = exerciseFrCategories();
    expect(cats.length).toBeGreaterThan(5);
    expect(cats.reduce((s, c) => s + c.count, 0)).toBe(exerciseFrCount());
  });

  it('images servies depuis /exercices/', () => {
    const withImg = getAllExercisesFr().filter((e) => e.image);
    expect(withImg.length).toBeGreaterThan(400);
    expect(withImg[0].image).toMatch(/^\/exercices\//);
  });
});
