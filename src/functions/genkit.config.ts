
import { Plugin } from '@genkit-ai/core';
import { googleAI } from '@genkit-ai/googleai';
import { vertexAI } from '@genkit-ai/vertexai';

/**
 * Exports the AI plugins for the application.
 *
 * We export the plugins without initializing them to avoid module
 * initialization issues. The plugins will be initialized on-demand 
 * when a Genkit flow is called.
 */
export function getPlugins(): Plugin[] {
  return [
    googleAI({
      // Specify the API key if needed, or it will be auto-detected from env vars.
      // apiKey: process.env.GEMINI_API_KEY,
    }),
    vertexAI({
      location: 'us-central1',
    }),
  ];
}
