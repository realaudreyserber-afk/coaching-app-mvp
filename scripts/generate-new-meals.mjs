import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

// 1. Load API Key
const envContent = fs.readFileSync('.env.local', 'utf8');
const apiKeyMatch = envContent.match(/GEMINI_API_KEY="?([^"\n\r]+)"?/);
if (!apiKeyMatch) {
  console.error("Error: GEMINI_API_KEY not found in .env.local");
  process.exit(1);
}
const apiKey = apiKeyMatch[1];

// 2. Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey });

// 3. Define New Recipes
const newRecipes = [
  {
    id: "frittata-epinards",
    name: "Frittata de blancs d'œufs aux épinards",
    description: "Blancs d'œufs, épinards frais, oignons, poivrons rouges, blanc de dinde émietté."
  },
  {
    id: "burrito-complet",
    name: "Burrito petit-déjeuner complet",
    description: "Œufs brouillés, haricots noirs, saucisse de poulet grillée, avocat, wrap de blé complet."
  },
  {
    id: "poulet-cajun",
    name: "Bowl de poulet Cajun et patates douces",
    description: "Blanc de poulet épicé Cajun, patates douces rôties, haricots verts, avocat."
  },
  {
    id: "salade-tacos-dinde",
    name: "Salade de tacos de dinde jar",
    description: "Dinde hachée maigre épicée, laitue romaine, tomates cerises, haricots noirs, maïs, avocat."
  },
  {
    id: "overnight-oats",
    name: "Overnight Oats protéinés aux baies",
    description: "Flocons d'avoine, lait d'amande, whey protéine, graines de chia, myrtilles et framboises fraîches."
  },
  {
    id: "wok-boeuf-gingembre",
    name: "Wok de bœuf gingembre et brocolis",
    description: "Rumsteck de bœuf émincé, têtes de brocoli, poivrons, sauce soja réduite en sodium, nouilles de riz."
  },
  {
    id: "cabillaud-croute-herbes",
    name: "Cabillaud en croûte d'herbes",
    description: "Filet de cabillaud, chapelure de blé complet aux herbes fraîches, asperges, quinoa."
  },
  {
    id: "bowl-fromage-blanc",
    name: "Bowl de fromage blanc protéiné",
    description: "Fromage blanc 0 %, protéines de lactosérum (whey) vanille, beurre de cacahuète, granola maison."
  }
];

// 4. Setup Directories
const srcMealsDir = path.resolve('public/meals');
const destMealsDir = 'E:\\article\\Nodream\\public\\meals';

fs.mkdirSync(srcMealsDir, { recursive: true });
fs.mkdirSync(destMealsDir, { recursive: true });

async function generateNewMeals() {
  console.log(`Starting image generation for ${newRecipes.length} new recipes...`);

  for (let i = 0; i < newRecipes.length; i++) {
    const recipe = newRecipes[i];
    const fileName = `${recipe.id}.jpg`;
    const srcFilePath = path.join(srcMealsDir, fileName);
    const destFilePath = path.join(destMealsDir, fileName);

    // Skip if both exist
    if (fs.existsSync(srcFilePath) && fs.existsSync(destFilePath)) {
      console.log(`[${i+1}/${newRecipes.length}] Skipping ${recipe.name} - already exists.`);
      continue;
    }

    console.log(`[${i+1}/${newRecipes.length}] Generating image for: ${recipe.name}...`);
    
    // Construct prompt
    const prompt = `Premium editorial food photography of ${recipe.name}. ${recipe.description}. Elegant plating, close-up shot, dark moody background, high-end culinary style, soft lighting.`;

    try {
      const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: prompt,
        config: {
          numberOfImages: 1,
          aspectRatio: '4:3',
          outputMimeType: 'image/jpeg',
        },
      });

      if (!response.generatedImages || response.generatedImages.length === 0) {
        throw new Error("No images returned from API");
      }

      const buffer = Buffer.from(response.generatedImages[0].image.imageBytes, 'base64');

      // Write to both folders
      fs.writeFileSync(srcFilePath, buffer);
      fs.writeFileSync(destFilePath, buffer);
      console.log(`Successfully generated and saved ${fileName}`);
    } catch (err) {
      console.error(`Failed to generate image for ${recipe.name}:`, err.message);
    }
  }

  console.log("All extra meal image generation completed!");
}

generateNewMeals();
