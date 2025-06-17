'use server';

/**
 * @fileOverview This file defines a Genkit flow for tuning the AI persona.
 *
 * - tuneAiPersona - A function that allows admins to tune the AI persona.
 * - TuneAiPersonaInput - The input type for the tuneAiPersona function.
 * - TuneAiPersonaOutput - The return type for the tuneAiPersona function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const TuneAiPersonaInputSchema = z.object({
  personaDescription: z
    .string()
    .describe("A description of the desired AI persona, including tone, style, and communication guidelines."),
});
export type TuneAiPersonaInput = z.infer<typeof TuneAiPersonaInputSchema>;

const TuneAiPersonaOutputSchema = z.object({
  updatedPersonaDescription: z
    .string()
    .describe("A confirmation of the updated AI persona description."),
});
export type TuneAiPersonaOutput = z.infer<typeof TuneAiPersonaOutputSchema>;

export async function tuneAiPersona(input: TuneAiPersonaInput): Promise<TuneAiPersonaOutput> {
  return tuneAiPersonaFlow(input);
}

const prompt = ai.definePrompt({
  name: 'tuneAiPersonaPrompt',
  input: {schema: TuneAiPersonaInputSchema},
  output: {schema: TuneAiPersonaOutputSchema},
  prompt: `You are an AI persona tuning tool. An admin has provided the following description for the desired AI persona:

  {{{personaDescription}}}

  Confirm that you have updated the AI persona description by returning the same description in the output.
  `,
});

const tuneAiPersonaFlow = ai.defineFlow(
  {
    name: 'tuneAiPersonaFlow',
    inputSchema: TuneAiPersonaInputSchema,
    outputSchema: TuneAiPersonaOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
