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

// 3. Define Onboarding Images List
const onboardingImages = [
  {
    id: "identity",
    name: "Onboarding Etape 1 - Identité",
    prompt: "Premium editorial photography of a focused athlete in a dark, minimalist gym setting. Backlit, dark moody background, gold and black theme, soft warm lighting, professional fitness branding style, high contrast.",
    aspectRatio: "3:4"
  },
  {
    id: "timezone",
    name: "Onboarding Etape 2 - Fuseau horaire",
    prompt: "Abstract premium design of an elegant, minimalist analog clock with glowing gold clockhands. Dark textured background, dark grey charcoal texture, soft golden light particles, editorial luxury design.",
    aspectRatio: "3:4"
  },
  {
    id: "measurements",
    name: "Onboarding Etape 3 - Mesures",
    prompt: "Premium close-up photography of a luxury metallic tape measure coiled on a dark textured background. Subtle gold light reflecting off the edges, dark charcoal theme, soft lighting, professional and clean design.",
    aspectRatio: "3:4"
  },
  {
    id: "activity",
    name: "Onboarding Etape 4 - Activité",
    prompt: "Premium action shot of an athlete in motion in a high-end minimalist training facility. Dramatic side lighting, dark moody ambiance, black and gold theme, soft volumetric mist, professional training style.",
    aspectRatio: "3:4"
  },
  {
    id: "goals",
    name: "Onboarding Etape 5 - Objectifs",
    prompt: "Abstract premium photography representing success and guidance, showing a path of light leading towards a golden horizon. Dark charcoal backdrop, golden glowing lines, soft lighting, motivational editorial style.",
    aspectRatio: "3:4"
  },
  {
    id: "generate",
    name: "Onboarding Etape 6 - Génération",
    prompt: "Abstract luxury design representing digital intelligence, showing glowing golden neural network lines and particles forming a human silhouette. Deep black background, soft warm lighting, futuristic premium aesthetic.",
    aspectRatio: "3:4"
  }
];

// 4. Define Community Avatars List
const communityAvatars = [
  {
    id: "elena",
    name: "Avatar Elena",
    prompt: "Premium studio headshot of a fit European woman with a focused expression. Warm side lighting, dark charcoal background, high contrast, professional fitness portrait, gold theme.",
    aspectRatio: "1:1"
  },
  {
    id: "marco",
    name: "Avatar Marco",
    prompt: "Premium studio headshot of a fit Mediterranean man with a short beard and focused expression. Warm side lighting, dark charcoal background, high contrast, professional fitness portrait, gold theme.",
    aspectRatio: "1:1"
  },
  {
    id: "anya",
    name: "Avatar Anya",
    prompt: "Premium studio headshot of a fit Slavic woman with blonde hair in a ponytail, focused expression. Warm side lighting, dark charcoal background, high contrast, professional fitness portrait, gold theme.",
    aspectRatio: "1:1"
  },
  {
    id: "david",
    name: "Avatar David",
    prompt: "Premium studio headshot of a fit athletic man, short hair, serious focused expression. Warm side lighting, dark charcoal background, high contrast, professional fitness portrait, gold theme.",
    aspectRatio: "1:1"
  },
  {
    id: "sarah",
    name: "Avatar Sarah",
    prompt: "Premium studio headshot of a fit athletic woman with curly dark hair, focused expression. Warm side lighting, dark charcoal background, high contrast, professional fitness portrait, gold theme.",
    aspectRatio: "1:1"
  }
];

// 5. Setup Directories
const localOnboardingDir = path.resolve('public/onboarding');
const dupOnboardingDir = 'E:\\article\\Nodream\\public\\onboarding';
const localAvatarsDir = path.resolve('public/avatars');
const dupAvatarsDir = 'E:\\article\\Nodream\\public\\avatars';

fs.mkdirSync(localOnboardingDir, { recursive: true });
fs.mkdirSync(dupOnboardingDir, { recursive: true });
fs.mkdirSync(localAvatarsDir, { recursive: true });
fs.mkdirSync(dupAvatarsDir, { recursive: true });

async function generateExtraImages() {
  console.log("--- Starting Onboarding Images Generation ---");
  for (let i = 0; i < onboardingImages.length; i++) {
    const img = onboardingImages[i];
    const fileName = `${img.id}.jpg`;
    const localPath = path.join(localOnboardingDir, fileName);
    const dupPath = path.join(dupOnboardingDir, fileName);

    if (fs.existsSync(localPath) && fs.existsSync(dupPath)) {
      console.log(`[Onboarding ${i+1}/${onboardingImages.length}] Skipping ${img.name} - already exists.`);
      continue;
    }

    console.log(`[Onboarding ${i+1}/${onboardingImages.length}] Generating: ${img.name}...`);
    try {
      const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: img.prompt,
        config: {
          numberOfImages: 1,
          aspectRatio: img.aspectRatio,
          outputMimeType: 'image/jpeg',
        },
      });

      if (!response.generatedImages || response.generatedImages.length === 0) {
        throw new Error("No images returned from API");
      }

      const buffer = Buffer.from(response.generatedImages[0].image.imageBytes, 'base64');
      fs.writeFileSync(localPath, buffer);
      fs.writeFileSync(dupPath, buffer);
      console.log(`Successfully generated and saved: ${fileName}`);
    } catch (err) {
      console.error(`Failed to generate ${img.name}:`, err.message);
    }
  }

  console.log("\n--- Starting Community Avatars Generation ---");
  for (let i = 0; i < communityAvatars.length; i++) {
    const img = communityAvatars[i];
    const fileName = `${img.id}.jpg`;
    const localPath = path.join(localAvatarsDir, fileName);
    const dupPath = path.join(dupAvatarsDir, fileName);

    if (fs.existsSync(localPath) && fs.existsSync(dupPath)) {
      console.log(`[Avatar ${i+1}/${communityAvatars.length}] Skipping ${img.name} - already exists.`);
      continue;
    }

    console.log(`[Avatar ${i+1}/${communityAvatars.length}] Generating: ${img.name}...`);
    try {
      const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: img.prompt,
        config: {
          numberOfImages: 1,
          aspectRatio: img.aspectRatio,
          outputMimeType: 'image/jpeg',
        },
      });

      if (!response.generatedImages || response.generatedImages.length === 0) {
        throw new Error("No images returned from API");
      }

      const buffer = Buffer.from(response.generatedImages[0].image.imageBytes, 'base64');
      fs.writeFileSync(localPath, buffer);
      fs.writeFileSync(dupPath, buffer);
      console.log(`Successfully generated and saved: ${fileName}`);
    } catch (err) {
      console.error(`Failed to generate ${img.name}:`, err.message);
    }
  }

  console.log("\nAll extra image generation completed!");
}

generateExtraImages();
