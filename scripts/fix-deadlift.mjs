import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

// Load API Key
const envContent = fs.readFileSync('.env.local', 'utf8');
const apiKeyMatch = envContent.match(/GEMINI_API_KEY="?([^"\n\r]+)"?/);
if (!apiKeyMatch) {
  console.error("Error: GEMINI_API_KEY not found in .env.local");
  process.exit(1);
}
const apiKey = apiKeyMatch[1];

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey });

const prompt = "Premium athletic fitness photography of a strong muscular athlete performing a barbell deadlift, lifting a heavy barbell off the floor in a dark gym. Gold and black color palette, cinematic dramatic lighting, professional fitness coach style.";

async function fix() {
  console.log("Regenerating deadlift.jpg...");
  try {
    const response = await ai.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt: prompt,
      config: {
        numberOfImages: 1,
        aspectRatio: '16:9',
        outputMimeType: 'image/jpeg',
      },
    });

    if (!response.generatedImages || response.generatedImages.length === 0) {
      throw new Error("No images returned from API");
    }

    const buffer = Buffer.from(response.generatedImages[0].image.imageBytes, 'base64');
    
    fs.writeFileSync('public/exercises/deadlift.jpg', buffer);
    fs.writeFileSync('E:\\article\\Nodream\\public\\exercises\\deadlift.jpg', buffer);
    console.log("Regenerated and saved deadlift.jpg successfully in both folders!");
  } catch (err) {
    console.error("Failed to regenerate deadlift image:", err.message);
  }
}

fix();
