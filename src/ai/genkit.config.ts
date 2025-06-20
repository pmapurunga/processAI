import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

export const ai = genkit({
  plugins: [googleAI({
    model: 'gemini-1.5-flash',
    embedder: 'text-embedding-004',
  })],
});
