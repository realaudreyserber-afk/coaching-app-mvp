/* eslint-disable @typescript-eslint/no-explicit-any */
import { VertexAI } from '@google-cloud/vertexai';

const project = process.env.GOOGLE_CLOUD_PROJECT || 'mock-project-id';
const location = process.env.VERTEX_AI_LOCATION || 'europe-west1';

// Build options dynamically to support serverless environments (like Vercel)
const vertexOptions: any = {
  project: project,
  location: location,
};

// If credentials are provided in the environment (e.g. on Vercel), pass them to GoogleAuth options
if (process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
  vertexOptions.googleAuthOptions = {
    credentials: {
      client_email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
  };
}

// Initialize Vertex AI client
export const vertexAI = new VertexAI(vertexOptions);

// Instantiate the two primary models we'll use in the MVP
export const modelPro = vertexAI.getGenerativeModel({
  model: process.env.VERTEX_AI_MODEL_PRO || 'gemini-2.5-pro',
  generationConfig: {
    temperature: 0.2,
  },
});

export const modelFlash = vertexAI.getGenerativeModel({
  model: process.env.VERTEX_AI_MODEL_FLASH || 'gemini-2.5-flash',
  generationConfig: {
    temperature: 0.1,
  },
});

/**
 * Helper to call Vertex AI models with structured output.
 * We enforce JSON responses and validate them using Zod on the caller side.
 */
export const getGenerativeModelWithJSON = (modelName: string) => {
  return vertexAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.2,
    },
  });
};
