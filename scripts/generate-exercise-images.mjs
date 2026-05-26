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

// 3. Define Exercises List
const exercises = [
  {
    id: "squat",
    name: "Squat",
    prompt: "Premium athletic photography of a muscular man doing a barbell back squat in a high-end gym. Deep squat position, focused expression, gold and black theme, soft volumetric lighting, dramatic shadow, professional training poster style."
  },
  {
    id: "bench-press",
    name: "Développé couché (Bench Press)",
    prompt: "Premium athletic photography of a muscular man doing barbell bench press in a high-end gym. Lying on a bench, lifting a heavy barbell, gold and black theme, soft volumetric lighting, dramatic shadow, professional training poster style."
  },
  {
    id: "deadlift",
    name: "Soulevé de terre (Deadlift)",
    prompt: "Premium athletic photography of a muscular man performing a heavy barbell deadlift in a high-end gym. Pulling phase, focused expression, gold and black theme, soft volumetric lighting, dramatic shadow, professional training poster style."
  },
  {
    id: "overhead-press",
    name: "Développé militaire (Overhead Press)",
    prompt: "Premium athletic photography of a muscular man doing barbell overhead press in a high-end gym. Pressing a heavy barbell overhead, gold and black theme, soft volumetric lighting, dramatic shadow, professional training poster style."
  },
  {
    id: "pull-up",
    name: "Tractions (Pull-up)",
    prompt: "Premium athletic photography of a muscular man doing pull-ups on a bar in a high-end gym. Back view showing defined back muscles, pulling up, gold and black theme, soft volumetric lighting, dramatic shadow, professional training poster style."
  },
  {
    id: "rowing",
    name: "Rowing / Tirage (Dumbbell Row)",
    prompt: "Premium athletic photography of a muscular man doing a barbell bent-over row or dumbbell row in a high-end gym. Pulling phase, back view, gold and black theme, soft volumetric lighting, dramatic shadow, professional training poster style."
  },
  {
    id: "push-up",
    name: "Pompes (Push-up)",
    prompt: "Premium athletic photography of an athlete doing push-ups on a gym floor. Low angle shot, focused expression, gold and black theme, soft volumetric lighting, dramatic shadow, professional training poster style."
  },
  {
    id: "dips",
    name: "Dips",
    prompt: "Premium athletic photography of a muscular man doing chest dips on parallel bars in a high-end gym. Full body shot, gold and black theme, soft volumetric lighting, dramatic shadow, professional training poster style."
  },
  {
    id: "biceps-curl",
    name: "Curl Biceps",
    prompt: "Premium athletic photography of a muscular man doing dumbbell biceps curls in a high-end gym. Focused on bicep contraction, gold and black theme, soft volumetric lighting, dramatic shadow, professional training poster style."
  },
  {
    id: "triceps-extension",
    name: "Extension Triceps",
    prompt: "Premium athletic photography of a muscular man doing overhead dumbbell triceps extension in a high-end gym. Defined triceps, gold and black theme, soft volumetric lighting, dramatic shadow, professional training poster style."
  },
  {
    id: "lunge",
    name: "Fentes (Lunges)",
    prompt: "Premium athletic photography of an athlete doing deep walking lunges in a high-end gym. Dynamic shot, gold and black theme, soft volumetric lighting, dramatic shadow, professional training poster style."
  },
  {
    id: "leg-press",
    name: "Presse à cuisses (Leg Press)",
    prompt: "Premium athletic photography of a person training on a leg press machine in a high-end gym. Leg contraction, gold and black theme, soft volumetric lighting, dramatic shadow, professional training poster style."
  },
  {
    id: "leg-extension",
    name: "Leg Extension",
    prompt: "Premium athletic photography of defined quadriceps muscles during leg extension on a gym machine. Gold and black theme, soft volumetric lighting, dramatic shadow, professional training poster style."
  },
  {
    id: "leg-curl",
    name: "Leg Curl",
    prompt: "Premium athletic photography of hamstrings contraction during leg curl on a gym machine. Gold and black theme, soft volumetric lighting, dramatic shadow, professional training poster style."
  },
  {
    id: "lateral-raise",
    name: "Élévations latérales (Lateral Raise)",
    prompt: "Premium athletic photography of a muscular man doing dumbbell lateral raises for shoulders in a high-end gym. Gold and black theme, soft volumetric lighting, dramatic shadow, professional training poster style."
  },
  {
    id: "plank",
    name: "Gainage (Plank)",
    prompt: "Premium athletic photography of an athlete maintaining a perfect forearm plank position on a gym mat. Side view, gold and black theme, soft volumetric lighting, dramatic shadow, professional training poster style."
  },
  {
    id: "crunch",
    name: "Crunch / Abdominaux",
    prompt: "Premium athletic photography of an athlete doing abdominal crunches on a gym mat. Focused core contraction, gold and black theme, soft volumetric lighting, dramatic shadow, professional training poster style."
  }
];

// 4. Setup Directories
const srcExDir = path.resolve('public/exercises');
const destExDir = 'E:\\article\\Nodream\\public\\exercises';

fs.mkdirSync(srcExDir, { recursive: true });
fs.mkdirSync(destExDir, { recursive: true });

async function generateExerciseImages() {
  console.log(`Starting image generation for ${exercises.length} exercises...`);

  for (let i = 0; i < exercises.length; i++) {
    const exercise = exercises[i];
    const fileName = `${exercise.id}.jpg`;
    const srcFilePath = path.join(srcExDir, fileName);
    const destFilePath = path.join(destExDir, fileName);

    // Skip if both exist
    if (fs.existsSync(srcFilePath) && fs.existsSync(destFilePath)) {
      console.log(`[${i+1}/${exercises.length}] Skipping ${exercise.name} - image already exists.`);
      continue;
    }

    console.log(`[${i+1}/${exercises.length}] Generating image for: ${exercise.name}...`);

    try {
      const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: exercise.prompt,
        config: {
          numberOfImages: 1,
          aspectRatio: '16:9',
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
      console.error(`Failed to generate image for ${exercise.name}:`, err.message);
    }
  }

  console.log("All done!");
}

generateExerciseImages();
