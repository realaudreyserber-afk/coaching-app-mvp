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

// 3. Define Recipes List (to match content/recipes/library.ts)
const recipes = [
  {
    id: "saumon-asperges",
    name: "Saumon poêlé aux asperges",
    description: "Filet de saumon sauvage, asperges vertes, citron, huile d'olive vierge."
  },
  {
    id: "pancakes-proteines",
    name: "Pancakes protéinés",
    description: "Flocons d'avoine, blanc d'œuf, whey vanille, banane écrasée, cannelle."
  },
  {
    id: "boeuf-brocolis",
    name: "Bœuf sauté brocolis",
    description: "Aiguillettes de bœuf 5 %, brocolis vapeur, sauce soja salée réduite, riz basmati."
  },
  {
    id: "salade-quinoa",
    name: "Salade quinoa végétal",
    description: "Quinoa tricolore, pois chiches grillés, avocat, tomates cerises, vinaigrette."
  },
  {
    id: "poulet-herbes",
    name: "Poulet grillé aux herbes",
    description: "Blanc de poulet, thym/romarin, patate douce, haricots verts vapeur."
  },
  {
    id: "smoothie-proteine",
    name: "Smoothie protéiné vert",
    description: "Épinards, whey vanille, banane, lait d'amande, graines de chia."
  },
  {
    id: "oeufs-truffe",
    name: "Œufs brouillés à la truffe",
    description: "Œufs brouillés crémeux, huile de truffe, pain complet, baby spinach."
  },
  {
    id: "barre-proteinee",
    name: "Barre protéinée maison",
    description: "Avoine, dattes, noix, chocolat noir 85 %, whey, beurre d'amande."
  },
  {
    id: "filet-mignon-patate-douce",
    name: "Filet mignon, patate douce",
    description: "Filet mignon de bœuf, purée de patate douce maison, légumes verts rôtis."
  },
  {
    id: "bowl-avoine-baies",
    name: "Bol avoine doré aux baies",
    description: "Flocons d'avoine, lait d'amande, myrtilles, noix, miel, cannelle."
  },
  {
    id: "cabillaud-courgettes",
    name: "Cabillaud aux courgettes",
    description: "Dos de cabillaud, courgettes grillées au citron, riz complet."
  },
  {
    id: "yaourt-fruits-noix",
    name: "Yaourt grec, fruits, noix",
    description: "Yaourt grec 0 %, fruits rouges, noix de pécan, miel d'acacia."
  }
];

// 4. Setup Directories
const srcMealsDir = path.resolve('public/meals');
const destMealsDir = 'E:\\article\\Nodream\\public\\meals';

fs.mkdirSync(srcMealsDir, { recursive: true });
fs.mkdirSync(destMealsDir, { recursive: true });

async function generateMealImages() {
  console.log(`Starting image generation for ${recipes.length} recipes...`);

  for (let i = 0; i < recipes.length; i++) {
    const recipe = recipes[i];
    const fileName = `${recipe.id}.jpg`;
    const srcFilePath = path.join(srcMealsDir, fileName);
    const destFilePath = path.join(destMealsDir, fileName);

    // Skip if both exist
    if (fs.existsSync(srcFilePath) && fs.existsSync(destFilePath)) {
      console.log(`[${i+1}/${recipes.length}] Skipping ${recipe.name} - image already exists.`);
      continue;
    }

    console.log(`[${i+1}/${recipes.length}] Generating image for: ${recipe.name}...`);
    
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

      const base64Bytes = response.generatedImages[0].image.imageBytes;
      const buffer = Buffer.from(base64Bytes, 'base64');

      // Write to both folders
      fs.writeFileSync(srcFilePath, buffer);
      fs.writeFileSync(destFilePath, buffer);
      console.log(`Successfully generated and saved ${fileName}`);
    } catch (err) {
      console.error(`Failed to generate image for ${recipe.name}:`, err.message);
    }
  }

  // 5. Update content/recipes/library.ts in both folders
  const libraryFiles = [
    path.resolve('content/recipes/library.ts'),
    'E:\\article\\Nodream\\content\\recipes\\library.ts'
  ];

  for (const libPath of libraryFiles) {
    if (!fs.existsSync(libPath)) {
      console.warn(`Library file not found at: ${libPath}`);
      continue;
    }

    let content = fs.readFileSync(libPath, 'utf8');
    let modified = false;

    for (const recipe of recipes) {
      const targetId = `id: "${recipe.id}",`;
      const photoStr = `photoUrl: "/meals/${recipe.id}.jpg",`;

      if (content.includes(targetId) && !content.includes(photoStr)) {
        content = content.replace(
          targetId,
          `${targetId}\n    ${photoStr}`
        );
        modified = true;
      }
    }

    if (modified) {
      fs.writeFileSync(libPath, content, 'utf8');
      console.log(`Updated library references in: ${libPath}`);
    } else {
      console.log(`Library references already up to date in: ${libPath}`);
    }
  }

  console.log("All done!");
}

generateMealImages();
