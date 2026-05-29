import { describe, it, expect } from 'vitest';
import { classifyTransformation, densityMetrics } from './nova';

describe('classifyTransformation (NOVA heuristique)', () => {
  it('NOVA 4 (ultra-transformé) sur signaux forts', () => {
    for (const n of [
      'Nuggets de poulet préemballé',
      'Barre chocolatée',
      'Biscuit fourré',
      'Chips de pomme de terre',
      'Soda au cola',
      'Cordon bleu de volaille',
      'Viennoiserie',
      'Pizza préemballée',
      'Poisson pané',
    ]) {
      expect(classifyTransformation(n).ultra_processed, n).toBe(true);
    }
    expect(classifyTransformation('Crème glacée vanille', 'glaces et sorbets').nova).toBe(4);
  });

  it('NOVA 1 (brut) pour les aliments simples — pas de faux AUT', () => {
    for (const n of [
      'Poulet, filet grillé',
      'Riz basmati cuit',
      'Épinard cuit',
      'Lentille verte cuite',
      'Banane crue',
      'Saumon cuit vapeur',
      'Panais cru', // piège : ne doit PAS matcher "pané"
    ]) {
      const c = classifyTransformation(n);
      expect(c.ultra_processed, n).toBe(false);
      expect(c.nova, n).toBe(1);
    }
  });

  it('NOVA 3 (transformé) / NOVA 2 (culinaire)', () => {
    expect(classifyTransformation('Saumon fumé').nova).toBe(3);
    expect(classifyTransformation('Jambon blanc').nova).toBe(3);
    expect(classifyTransformation('Pain complet').nova).toBe(3);
    expect(classifyTransformation("Huile d'olive vierge").nova).toBe(2);
  });

  it('densité : protéines / 100 kcal (levier satiété en cut)', () => {
    const poulet = densityMetrics({ kcal: 165, protein_g: 31 });
    const biscuit = densityMetrics({ kcal: 480, protein_g: 6 });
    expect(poulet.protein_per_100kcal!).toBeGreaterThan(biscuit.protein_per_100kcal!);
    expect(poulet.protein_per_100kcal).toBeCloseTo(18.8, 0);
  });
});
