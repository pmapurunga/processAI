"use strict";
'use server';
Object.defineProperty(exports, "__esModule", { value: true });
exports.tuneAiPersona = tuneAiPersona;
/**
 * @fileOverview This file defines a Genkit flow for tuning the AI persona.
 *
 * - tuneAiPersona - A function that allows admins to tune the AI persona.
 * - TuneAiPersonaInput - The input type for the tuneAiPersona function.
 * - TuneAiPersonaOutput - The return type for the tuneAiPersona function.
 */
const genkit_config_1 = require("@/ai/genkit.config"); // Corrected import path
const genkit_1 = require("genkit");
const TuneAiPersonaInputSchema = genkit_1.z.object({
    personaDescription: genkit_1.z
        .string()
        .describe("A description of the desired AI persona, including tone, style, and communication guidelines."),
});
const TuneAiPersonaOutputSchema = genkit_1.z.object({
    updatedPersonaDescription: genkit_1.z
        .string()
        .describe("A confirmation of the updated AI persona description."),
});
async function tuneAiPersona(input) {
    return tuneAiPersonaFlow(input);
}
const prompt = genkit_config_1.ai.definePrompt({
    name: 'tuneAiPersonaPrompt',
    input: { schema: TuneAiPersonaInputSchema },
    output: { schema: TuneAiPersonaOutputSchema },
    prompt: `You are an AI persona tuning tool. An admin has provided the following description for the desired AI persona:

  {{{personaDescription}}}

  Confirm that you have updated the AI persona description by returning the same description in the output.
  `,
});
const tuneAiPersonaFlow = genkit_config_1.ai.defineFlow({
    name: 'tuneAiPersonaFlow',
    inputSchema: TuneAiPersonaInputSchema,
    outputSchema: TuneAiPersonaOutputSchema,
}, async (input) => {
    const { output } = await prompt(input);
    return output;
});
//# sourceMappingURL=tune-ai-persona.js.map