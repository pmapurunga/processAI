import { GenkitPlugin } from '@genkit-ai/core';
import { googleAI, textEmbedding004 } from '@genkit-ai/googleai';
import { vertexAI } from '@genkit-ai/vertexai';

/**
 * Exports the AI plugins for the application.
 *
 * We export the plugins without initializing them to avoid module
 * initialization issues with Next.js and Turbopack. The plugins will be
 * initialized on-demand when a Genkit flow is called.
 */
export function getPlugins(): GenkitPlugin[] {
  return [
    googleAI(),
    vertexAI({
      location: 'us-central1',
      model: 'gemini-1.5-pro',
    }),
  ];
}

export { textEmbedding004 };
