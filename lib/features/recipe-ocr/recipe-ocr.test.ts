import { describe, it, expect } from 'vitest';
import { RecipeOcrResultSchema } from './schema';

describe('Recipe OCR Result Schema', () => {
  it('should validate parsed recipes', () => {
    const data = {
      name: 'Salade de quinoa',
      servings: 2,
      ingredients: [
        { name: 'Quinoa', qty: 100, unit: 'g', kcal: 368, p: 14, c: 64, f: 6 },
        { name: 'Tomates', qty: 150, unit: 'g', kcal: 27, p: 1.5, c: 5.8, f: 0.3 }
      ],
      steps: [
        "Rincer et cuire le quinoa.",
        "Couper les tomates en dés et mélanger."
      ],
      totalKcal: 395,
      totalP: 15.5,
      totalC: 69.8,
      totalF: 6.3
    };

    const parsed = RecipeOcrResultSchema.safeParse(data);
    expect(parsed.success).toBe(true);
  });

  it('should fail on empty recipe name', () => {
    const data = {
      name: '',
      servings: 1,
      ingredients: [],
      steps: [],
      totalKcal: 0,
      totalP: 0,
      totalC: 0,
      totalF: 0
    };

    const parsed = RecipeOcrResultSchema.safeParse(data);
    expect(parsed.success).toBe(false);
  });
});
