
import { Plugin } from '@genkit-ai/core';
import { googleAI, textEmbedding004 } from '@genkit-ai/googleai';
import { vertexAI } from '@genkit-ai/vertexai';

// Import the flows so that they are recognized as deployable Cloud Functions
import './flows/query-document';
import './flows/summarize-document';
import './flows/tune-ai-persona';

/**
 * Exports the AI plugins for the application.
 *
 * We export the plugins without initializing them to avoid module
 * initialization issues with Next.js and Turbopack. The plugins will be
 * initialized on-demand when a Genkit flow is called.
 */
export function getPlugins(): Plugin[] {
  return [
    googleAI(),
    vertexAI({
      location: 'us-central1',
      model: 'gemini-1.5-pro',
    }),
  ];
}

export { textEmbedding004 };
