// Consolidates analysis from Firestore and creates a new chat with Gemini for process interaction.

'use server';

/**
 * @fileOverview Creates a chat interface with consolidated process documents from Firestore.
 *
 * - consolidateAnalysisChat - A function that initializes a chat with consolidated process documents.
 * - ConsolidateAnalysisChatInput - The input type for the consolidateAnalysisChat function.
 * - ConsolidateAnalysisChatOutput - The return type for the consolidateAnalysisChat function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ConsolidateAnalysisChatInputSchema = z.object({
  processId: z.string().describe('The ID of the process to consolidate documents from.'),
  prompt: z.string().describe('Instructions for Gemini on how to interact with the consolidated documents'),
});
export type ConsolidateAnalysisChatInput = z.infer<typeof ConsolidateAnalysisChatInputSchema>;

const ConsolidateAnalysisChatOutputSchema = z.object({
  chatResponse: z.string().describe('The response from the Gemini chat based on consolidated documents.'),
});
export type ConsolidateAnalysisChatOutput = z.infer<typeof ConsolidateAnalysisChatOutputSchema>;

export async function consolidateAnalysisChat(input: ConsolidateAnalysisChatInput): Promise<ConsolidateAnalysisChatOutput> {
  return consolidateAnalysisChatFlow(input);
}

const consolidateAnalysisChatPrompt = ai.definePrompt({
  name: 'consolidateAnalysisChatPrompt',
  input: {schema: ConsolidateAnalysisChatInputSchema},
  output: {schema: ConsolidateAnalysisChatOutputSchema},
  prompt: `You are an expert legal assistant with access to documents from a legal case.
  The documents for process ID {{{processId}}} have been consolidated and are available for you to reference.
  Use these documents to answer the user's question, following these instructions: {{{prompt}}}`,
});

const consolidateAnalysisChatFlow = ai.defineFlow(
  {
    name: 'consolidateAnalysisChatFlow',
    inputSchema: ConsolidateAnalysisChatInputSchema,
    outputSchema: ConsolidateAnalysisChatOutputSchema,
  },
  async input => {
    // TODO: Fetch documents from Firestore based on processId, and put them in the prompt input
    // as a single string that Gemini can read and parse.
    // The user stories requested Gemini Pro 2.5, so we will rely on its
    // ability to understand the JSON document without requiring intermediate
    // steps to marshall the documents into a single string.

    // For now, just pass the processId and prompt to the prompt.
    const {output} = await consolidateAnalysisChatPrompt(input);

    return {
      chatResponse: output!.chatResponse,
    };
  }
);
