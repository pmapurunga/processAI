'use server';

/**
 * @fileOverview Implements the query document flow using RAG to answer questions about a document.
 *
 * - queryDocument - A function that handles querying a document and returning an answer.
 * - QueryDocumentInput - The input type for the queryDocument function.
 * - QueryDocumentOutput - The return type for the queryDocument function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const QueryDocumentInputSchema = z.object({
  query: z.string().describe('The question to ask about the document.'),
  documentChunks: z
    .array(z.string())
    .describe('The relevant chunks of text from the document.'),
});
export type QueryDocumentInput = z.infer<typeof QueryDocumentInputSchema>;

const QueryDocumentOutputSchema = z.object({
  answer: z.string().describe('The answer to the question about the document.'),
});
export type QueryDocumentOutput = z.infer<typeof QueryDocumentOutputSchema>;

export async function queryDocument(input: QueryDocumentInput): Promise<QueryDocumentOutput> {
  return queryDocumentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'queryDocumentPrompt',
  input: {schema: QueryDocumentInputSchema},
  output: {schema: QueryDocumentOutputSchema},
  prompt: `You are a helpful AI assistant that answers questions about a document. Use the context provided to answer the question. Do not make up answers that are not in the context. If you don't know the answer, just say you don't know.\n\nContext:\n{{#each documentChunks}}{{{this}}}\n{{/each}}\n\nQuestion: {{{query}}}`,
});

const queryDocumentFlow = ai.defineFlow(
  {
    name: 'queryDocumentFlow',
    inputSchema: QueryDocumentInputSchema,
    outputSchema: QueryDocumentOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
