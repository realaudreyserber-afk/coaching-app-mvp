import { Micronutrients } from './schema';

export interface FoodMicronutrientProfile {
  name: string;
  category: 'carbs' | 'proteins' | 'lipids' | 'vegetables' | 'fruits' | 'dairy' | 'other';
  nutrients100g: Micronutrients;
}

// Strictly sourced values per 100g from Ciqual/USDA nutritional tables.
// Values represent the average composition of these common western foods.
export const FOOD_MICRONUTRIENT_DB: Record<string, FoodMicronutrientProfile> = {
  // Carbs
  "riz cuit": {
    name: "Riz blanc cuit",
    category: "carbs",
    nutrients100g: {
      calcium: 10, magnesium: 12, potassium: 35, iron: 0.2, zinc: 0.5, sodium: 1,
      vitaminA: 0, vitaminC: 0, vitaminD: 0, vitaminE: 0.04, vitaminK: 0,
      vitaminB6: 0.05, vitaminB9: 4, vitaminB12: 0
    }
  },
  "riz cru": {
    name: "Riz blanc cru",
    category: "carbs",
    nutrients100g: {
      calcium: 28, magnesium: 75, potassium: 115, iron: 0.8, zinc: 1.1, sodium: 5,
      vitaminA: 0, vitaminC: 0, vitaminD: 0, vitaminE: 0.11, vitaminK: 0,
      vitaminB6: 0.16, vitaminB9: 8, vitaminB12: 0
    }
  },
  "pates cuites": {
    name: "Pâtes blanches cuites",
    category: "carbs",
    nutrients100g: {
      calcium: 7, magnesium: 18, potassium: 24, iron: 0.5, zinc: 0.5, sodium: 1,
      vitaminA: 0, vitaminC: 0, vitaminD: 0, vitaminE: 0.06, vitaminK: 0.1,
      vitaminB6: 0.03, vitaminB9: 6, vitaminB12: 0
    }
  },
  "pates crues": {
    name: "Pâtes blanches crues",
    category: "carbs",
    nutrients100g: {
      calcium: 21, magnesium: 53, potassium: 223, iron: 1.3, zinc: 1.4, sodium: 6,
      vitaminA: 0, vitaminC: 0, vitaminD: 0, vitaminE: 0.11, vitaminK: 0.3,
      vitaminB6: 0.14, vitaminB9: 18, vitaminB12: 0
    }
  },
  "pomme de terre cuite": {
    name: "Pomme de terre cuite à l'eau",
    category: "carbs",
    nutrients100g: {
      calcium: 8, magnesium: 20, potassium: 328, iron: 0.3, zinc: 0.3, sodium: 4,
      vitaminA: 0, vitaminC: 7.4, vitaminD: 0, vitaminE: 0.01, vitaminK: 0.1,
      vitaminB6: 0.25, vitaminB9: 9, vitaminB12: 0
    }
  },
  "flocons d'avoine": {
    name: "Flocons d'avoine",
    category: "carbs",
    nutrients100g: {
      calcium: 52, magnesium: 138, potassium: 362, iron: 4.2, zinc: 3.2, sodium: 6,
      vitaminA: 0, vitaminC: 0, vitaminD: 0, vitaminE: 0.42, vitaminK: 2,
      vitaminB6: 0.12, vitaminB9: 32, vitaminB12: 0
    }
  },
  "pain complet": {
    name: "Pain complet",
    category: "carbs",
    nutrients100g: {
      calcium: 73, magnesium: 78, potassium: 250, iron: 2.5, zinc: 1.8, sodium: 450,
      vitaminA: 0, vitaminC: 0, vitaminD: 0, vitaminE: 0.35, vitaminK: 2.8,
      vitaminB6: 0.15, vitaminB9: 38, vitaminB12: 0
    }
  },

  // Proteins
  "blanc de poulet": {
    name: "Blanc de poulet cuit",
    category: "proteins",
    nutrients100g: {
      calcium: 15, magnesium: 29, potassium: 256, iron: 1.0, zinc: 1.0, sodium: 74,
      vitaminA: 6, vitaminC: 0, vitaminD: 0.1, vitaminE: 0.27, vitaminK: 0.2,
      vitaminB6: 0.6, vitaminB9: 4, vitaminB12: 0.3
    }
  },
  "steak hache 5%": {
    name: "Steak haché bœuf 5% MG cuit",
    category: "proteins",
    nutrients100g: {
      calcium: 12, magnesium: 23, potassium: 350, iron: 2.7, zinc: 5.3, sodium: 62,
      vitaminA: 0, vitaminC: 0, vitaminD: 0.1, vitaminE: 0.2, vitaminK: 1.1,
      vitaminB6: 0.4, vitaminB9: 9, vitaminB12: 2.1
    }
  },
  "saumon": {
    name: "Pavé de saumon cuit",
    category: "proteins",
    nutrients100g: {
      calcium: 12, magnesium: 28, potassium: 384, iron: 0.3, zinc: 0.4, sodium: 60,
      vitaminA: 14, vitaminC: 0, vitaminD: 11.0, vitaminE: 1.4, vitaminK: 0.1,
      vitaminB6: 0.6, vitaminB9: 25, vitaminB12: 3.2
    }
  },
  "oeuf entier": {
    name: "Œuf entier cuit (dur/au plat)",
    category: "proteins",
    nutrients100g: {
      calcium: 50, magnesium: 12, potassium: 130, iron: 1.8, zinc: 1.3, sodium: 124,
      vitaminA: 160, vitaminC: 0, vitaminD: 2.2, vitaminE: 1.0, vitaminK: 0.3,
      vitaminB6: 0.12, vitaminB9: 44, vitaminB12: 1.1
    }
  },
  "blanc d'oeuf": {
    name: "Blanc d'œuf cuit",
    category: "proteins",
    nutrients100g: {
      calcium: 7, magnesium: 11, potassium: 163, iron: 0.08, zinc: 0.03, sodium: 166,
      vitaminA: 0, vitaminC: 0, vitaminD: 0, vitaminE: 0, vitaminK: 0,
      vitaminB6: 0.01, vitaminB9: 4, vitaminB12: 0.09
    }
  },
  "thon en boite": {
    name: "Thon au naturel en conserve égoutté",
    category: "proteins",
    nutrients100g: {
      calcium: 11, magnesium: 27, potassium: 237, iron: 1.3, zinc: 0.8, sodium: 338,
      vitaminA: 13, vitaminC: 0, vitaminD: 2.4, vitaminE: 0.8, vitaminK: 0.1,
      vitaminB6: 0.35, vitaminB9: 4, vitaminB12: 2.2
    }
  },

  // Vegetables
  "epinards": {
    name: "Épinards cuits à l'eau",
    category: "vegetables",
    nutrients100g: {
      calcium: 136, magnesium: 87, potassium: 466, iron: 3.6, zinc: 0.8, sodium: 70,
      vitaminA: 524, vitaminC: 9.8, vitaminD: 0, vitaminE: 2.1, vitaminK: 494,
      vitaminB6: 0.24, vitaminB9: 146, vitaminB12: 0
    }
  },
  "brocoli": {
    name: "Brocoli cuit à la vapeur",
    category: "vegetables",
    nutrients100g: {
      calcium: 40, magnesium: 21, potassium: 293, iron: 0.7, zinc: 0.4, sodium: 15,
      vitaminA: 77, vitaminC: 64.9, vitaminD: 0, vitaminE: 1.5, vitaminK: 141,
      vitaminB6: 0.2, vitaminB9: 108, vitaminB12: 0
    }
  },
  "haricots verts": {
    name: "Haricots verts cuits à l'eau",
    category: "vegetables",
    nutrients100g: {
      calcium: 37, magnesium: 18, potassium: 146, iron: 0.6, zinc: 0.2, sodium: 2,
      vitaminA: 34, vitaminC: 9.7, vitaminD: 0, vitaminE: 0.46, vitaminK: 48,
      vitaminB6: 0.06, vitaminB9: 32, vitaminB12: 0
    }
  },
  "tomate": {
    name: "Tomate crue",
    category: "vegetables",
    nutrients100g: {
      calcium: 10, magnesium: 11, potassium: 237, iron: 0.3, zinc: 0.17, sodium: 5,
      vitaminA: 42, vitaminC: 13.7, vitaminD: 0, vitaminE: 0.54, vitaminK: 7.9,
      vitaminB6: 0.08, vitaminB9: 15, vitaminB12: 0
    }
  },

  // Fruits
  "banane": {
    name: "Banane",
    category: "fruits",
    nutrients100g: {
      calcium: 5, magnesium: 27, potassium: 358, iron: 0.26, zinc: 0.15, sodium: 1,
      vitaminA: 3, vitaminC: 8.7, vitaminD: 0, vitaminE: 0.1, vitaminK: 0.5,
      vitaminB6: 0.4, vitaminB9: 20, vitaminB12: 0
    }
  },
  "pomme": {
    name: "Pomme avec peau",
    category: "fruits",
    nutrients100g: {
      calcium: 6, magnesium: 5, potassium: 107, iron: 0.12, zinc: 0.04, sodium: 1,
      vitaminA: 3, vitaminC: 4.6, vitaminD: 0, vitaminE: 0.18, vitaminK: 2.2,
      vitaminB6: 0.04, vitaminB9: 3, vitaminB12: 0
    }
  },
  "avocat": {
    name: "Avocat",
    category: "fruits",
    nutrients100g: {
      calcium: 12, magnesium: 29, potassium: 485, iron: 0.55, zinc: 0.64, sodium: 7,
      vitaminA: 7, vitaminC: 10.0, vitaminD: 0, vitaminE: 2.07, vitaminK: 21,
      vitaminB6: 0.26, vitaminB9: 81, vitaminB12: 0
    }
  },

  // Lipids / Nuts
  "huile d'olive": {
    name: "Huile d'olive",
    category: "lipids",
    nutrients100g: {
      calcium: 1, magnesium: 0, potassium: 1, iron: 0.56, zinc: 0, sodium: 2,
      vitaminA: 0, vitaminC: 0, vitaminD: 0, vitaminE: 14.3, vitaminK: 60.2,
      vitaminB6: 0, vitaminB9: 0, vitaminB12: 0
    }
  },
  "amandes": {
    name: "Amandes",
    category: "lipids",
    nutrients100g: {
      calcium: 264, magnesium: 268, potassium: 705, iron: 3.7, zinc: 3.1, sodium: 1,
      vitaminA: 0, vitaminC: 0, vitaminD: 0, vitaminE: 26.2, vitaminK: 0,
      vitaminB6: 0.14, vitaminB9: 50, vitaminB12: 0
    }
  },

  // Dairy
  "fromage blanc": {
    name: "Fromage blanc 3.2% MG",
    category: "dairy",
    nutrients100g: {
      calcium: 110, magnesium: 9, potassium: 106, iron: 0.05, zinc: 0.35, sodium: 45,
      vitaminA: 26, vitaminC: 0, vitaminD: 0.05, vitaminE: 0.05, vitaminK: 0.1,
      vitaminB6: 0.04, vitaminB9: 12, vitaminB12: 0.4
    }
  },
  "whey": {
    name: "Isolat de lactosérum (Whey protein)",
    category: "dairy",
    nutrients100g: {
      calcium: 400, magnesium: 45, potassium: 380, iron: 0.4, zinc: 0.2, sodium: 160,
      vitaminA: 0, vitaminC: 0, vitaminD: 0, vitaminE: 0, vitaminK: 0,
      vitaminB6: 0.05, vitaminB9: 5, vitaminB12: 0.6
    }
  }
};

// Normalize names for fuzzy matching (accent collapse and lowercasing)
export const getNormalizedFoodKey = (name: string): string => {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[^a-z0-9\s]/g, "")    // remove special chars
    .trim();
};

/**
 * Searches our local reference database for matching food keys
 */
export const findLocalFoodProfile = (foodName: string): FoodMicronutrientProfile | null => {
  const normInput = getNormalizedFoodKey(foodName);
  
  // Direct match
  if (FOOD_MICRONUTRIENT_DB[normInput]) {
    return FOOD_MICRONUTRIENT_DB[normInput];
  }

  // Substring matching
  for (const key of Object.keys(FOOD_MICRONUTRIENT_DB)) {
    if (normInput.includes(key) || key.includes(normInput)) {
      return FOOD_MICRONUTRIENT_DB[key];
    }
  }

  return null;
};
