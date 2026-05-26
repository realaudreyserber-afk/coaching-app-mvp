import fs from 'fs';
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

async function listModels() {
  try {
    const response = await ai.models.list();
    console.log("Raw response:", JSON.stringify(response, null, 2));
  } catch (err) {
    console.error("Error listing models:", err.message);
  }
}

listModels();
