
import { defineFlow, onFlow } from '@genkit-ai/flow';
import { z } from 'zod';
import { gemini15Pro } from '@genkit-ai/googleai';

// Define the input schema for the AI persona tuning flow
export const TuneAiPersonaInputSchema = z.object({
  personaDescription: z
    .string()
    .describe("A description of the desired AI persona, including tone, style, and communication guidelines."),
});
export type TuneAiPersonaInput = z.infer<typeof TuneAiPersonaInputSchema>;

// Define the output schema for the AI persona tuning flow
export const TuneAiPersonaOutputSchema = z.object({
  updatedPersonaDescription: z
    .string()
    .describe("A confirmation of the updated AI persona description."),
});
export type TuneAiPersonaOutput = z.infer<typeof TuneAiPersonaOutputSchema>;

// Define the AI persona tuning flow
export const tuneAiPersonaFlow = defineFlow(
  {
    name: 'tuneAiPersonaFlow',
    inputSchema: TuneAiPersonaInputSchema,
    outputSchema: TuneAiPersonaOutputSchema,
  },
  async (input: TuneAiPersonaInput) => {
    const { personaDescription } = input;

    const prompt = `You are an AI persona tuning tool. An admin has provided the following description for the desired AI persona:

    ${personaDescription}
  
    Confirm that you have updated the AI persona description by returning the same description in the output.
    `;

    const llmResponse = await gemini15Pro.generate({
      prompt,
    });

    return {
      updatedPersonaDescription: llmResponse.text(),
    };
  }
);

// Export the flow as a Firebase Function
export const tuneAiPersona = onFlow(tuneAiPersonaFlow, {
  name: 'tune-ai-persona',
  https: {
    concurrency: 1,
    timeoutSeconds: 600,
    memory: '1GiB',
    cpu: 1,
  },
  secrets: ['GEMINI_API_KEY'],
});
