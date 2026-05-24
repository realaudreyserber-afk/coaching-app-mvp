import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchFromOpenFoodFacts } from './client';
import { OFFProductSchema, FoodSchema } from './schema';

describe('Barcode Scanner Schema & Client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Schemas Validation', () => {
    it('should validate and fill defaults for a raw OFF product', () => {
      const rawProduct = {
        product_name: 'Super Muesli',
        brands: 'Bio Brand',
        nutriments: {
          'energy-kcal_100g': 350,
          proteins_100g: 10,
          carbohydrates_100g: 65,
          fat_100g: 4.5,
        },
        allergens_tags: ['en:gluten', 'en:nuts'],
        nutrition_grades: 'a',
        nova_group: 3,
        image_url: 'https://images.local/muesli.jpg',
      };

      const parsed = OFFProductSchema.safeParse(rawProduct);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.product_name).toBe('Super Muesli');
        expect(parsed.data.nutriments.proteins_100g).toBe(10);
      }
    });

    it('should validate complete Food schema', () => {
      const food = {
        id: '12345678',
        barcode: '12345678',
        name: 'Muesli',
        brand: 'Bio Brand',
        kcal_100g: 350,
        p_100g: 10,
        c_100g: 65,
        f_100g: 4.5,
        fiber_100g: 8,
        sodium_100g: 0.01,
        allergens: ['gluten', 'nuts'],
        nutriscore: 'A',
        novascore: 3,
        imageUrl: 'https://images.local/muesli.jpg',
      };

      const parsed = FoodSchema.safeParse(food);
      expect(parsed.success).toBe(true);
    });
  });

  describe('fetchFromOpenFoodFacts', () => {
    it('should fetch and normalize data from Open Food Facts API', async () => {
      const mockProduct = {
        status: 1,
        product: {
          product_name: 'Nutella 400g',
          brands: 'Ferrero',
          nutriments: {
            'energy-kcal_100g': 539,
            proteins_100g: 6.3,
            carbohydrates_100g: 57.5,
            fat_100g: 30.9,
            fiber_100g: 0,
            sodium_100g: 0.04,
          },
          allergens_tags: ['en:soybeans', 'en:milk', 'en:nuts'],
          nutrition_grades: 'e',
          nova_group: 4,
          image_url: 'https://images.local/nutella.jpg',
        },
      };

      // Mock global fetch
      const mockFetch = vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockProduct),
        })
      );
      vi.stubGlobal('fetch', mockFetch);

      const food = await fetchFromOpenFoodFacts('3017670010105');
      
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(food).not.toBeNull();
      if (food) {
        expect(food.id).toBe('3017670010105');
        expect(food.name).toBe('Nutella 400g');
        expect(food.brand).toBe('Ferrero');
        expect(food.kcal_100g).toBe(539);
        expect(food.p_100g).toBe(6.3);
        expect(food.allergens).toContain('soybeans');
        expect(food.allergens).toContain('milk');
        expect(food.nutriscore).toBe('E');
      }
    });

    it('should return null when product is not found', async () => {
      const mockFetch = vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ status: 0 }),
        })
      );
      vi.stubGlobal('fetch', mockFetch);

      const food = await fetchFromOpenFoodFacts('00000000');
      expect(food).toBeNull();
    });
  });
});
