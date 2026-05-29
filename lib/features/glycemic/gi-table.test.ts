import { describe, it, expect } from 'vitest';
import {
  GI_TABLE,
  giCategory,
  glCategory,
  glycemicLoad,
  findGi,
  estimateGlycemic,
} from './gi-table';

describe('gi-table (IG / CG)', () => {
  it('catégories IG (bas<55, moyen 55-70, élevé>70)', () => {
    expect(giCategory(36)).toBe('bas');
    expect(giCategory(65)).toBe('moyen');
    expect(giCategory(95)).toBe('eleve');
  });

  it('CG = IG × glucides / 100 + catégories', () => {
    expect(glycemicLoad(72, 9)).toBe(6); // pastèque petite portion
    expect(glCategory(6)).toBe('basse');
    expect(glCategory(15)).toBe('moderee');
    expect(glCategory(25)).toBe('elevee');
  });

  it('PASTÈQUE : IG élevé mais CG basse (raisonner en CG, pas IG nu)', () => {
    const g = estimateGlycemic('pastèque', 9);
    expect(g).not.toBeNull();
    expect(g!.gi_category).toBe('eleve'); // IG ~72
    expect(g!.gl_category).toBe('basse'); // mais CG faible sur la portion
  });

  it('PIÈGE : chocolat noir a un IG BAS (≠ sain)', () => {
    expect(findGi('chocolat noir 70%')!.gi).toBeLessThan(55);
  });

  it('findGi : matching tolérant + mot-clé le plus spécifique', () => {
    expect(findGi('riz basmati cuit')?.key).toBe('riz_basmati');
    expect(findGi('baguette tradition')?.key).toBe('baguette');
    expect(findGi('lentilles vertes cuites')?.key).toBe('lentilles');
    expect(findGi('flocons d’avoine')?.key).toBe('avoine');
  });

  it('findGi : null si IG inconnu (ex: aliment non glucidique)', () => {
    expect(findGi('blanc de poulet grillé')).toBeNull();
    expect(estimateGlycemic('saumon', 0)).toBeNull();
  });

  it('estimateGlycemic : CG d’une pomme (portion)', () => {
    const g = estimateGlycemic('pomme', 20);
    expect(g!.gi).toBe(36);
    expect(g!.gl).toBe(7); // 36×20/100
    expect(g!.gl_category).toBe('basse');
  });

  it('table : valeurs plausibles + clés uniques', () => {
    expect(GI_TABLE.length).toBeGreaterThan(50);
    expect(new Set(GI_TABLE.map((e) => e.key)).size).toBe(GI_TABLE.length);
    for (const e of GI_TABLE) {
      expect(e.gi).toBeGreaterThan(0);
      expect(e.gi).toBeLessThanOrEqual(100);
      expect(e.match.length).toBeGreaterThan(0);
    }
  });
});
