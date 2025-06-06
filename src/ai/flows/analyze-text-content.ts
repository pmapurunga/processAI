
'use server';
/**
 * @fileOverview A Genkit flow to analyze provided text content based on a custom prompt.
 *
 * - analyzeTextContent: An exported function that invokes the Genkit flow.
 * - AnalyzeTextContentInput: The Zod schema for the input.
 * - AnalyzeTextContentOutput: The Zod schema for the output (a JSON string).
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

export const AnalyzeTextContentInputSchema = z.object({
  textContent: z.string().describe('The full text content extracted from a document.'),
  customAnalysisPrompt: z.string().describe('A user-defined prompt to guide the AI analysis of the text content. The AI should focus its analysis based on this prompt and structure its output as JSON.'),
});
export type AnalyzeTextContentInput = z.infer<typeof AnalyzeTextContentInputSchema>;

export const AnalyzeTextContentOutputSchema = z.object({
  analysisJsonString: z.string().describe('A JSON string representing the structured analysis of the text content, generated according to the customAnalysisPrompt. This string should be parsable into a valid JSON object.'),
});
export type AnalyzeTextContentOutput = z.infer<typeof AnalyzeTextContentOutputSchema>;

export async function analyzeTextContent(input: AnalyzeTextContentInput): Promise<AnalyzeTextContentOutput> {
  return analyzeTextContentFlow(input);
}

const analysisPrompt = ai.definePrompt({
  name: 'analyzeTextContentPrompt',
  input: {schema: AnalyzeTextContentInputSchema},
  output: {schema: AnalyzeTextContentOutputSchema},
  prompt: `You are an expert document analyst. You will be given a large piece of text extracted from a document and a custom analysis prompt.
Your task is to carefully analyze the provided text content based *solely* on the instructions and focus areas outlined in the 'Custom Analysis Prompt'.
The output of your analysis MUST be a single, valid JSON string. Adhere strictly to the desired structure or information points mentioned in the 'Custom Analysis Prompt' when formulating this JSON.

Custom Analysis Prompt:
{{{customAnalysisPrompt}}}

Document Text Content:
{{{textContent}}}

Return ONLY the JSON string as your analysis result.
`,
  // Example config to potentially reduce blocking for diverse user prompts, adjust as needed.
  // Be mindful of safety implications.
  config: {
    safetySettings: [
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_ONLY_HIGH',
      },
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
       {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      }
    ],
  }
});

const analyzeTextContentFlow = ai.defineFlow(
  {
    name: 'analyzeTextContentFlow',
    inputSchema: AnalyzeTextContentInputSchema,
    outputSchema: AnalyzeTextContentOutputSchema,
  },
  async (input) => {
    const {output} = await analysisPrompt(input);
    if (!output) {
      throw new Error('AI analysis returned no output. This might be due to content filtering or an internal error.');
    }
    // Basic check for JSON-like structure. Robust parsing should happen in the calling function.
    const trimmedOutput = output.analysisJsonString.trim();
    if (!((trimmedOutput.startsWith('{') && trimmedOutput.endsWith('}')) || (trimmedOutput.startsWith('[') && trimmedOutput.endsWith(']')))) {
      console.warn(`AI output for analyzeTextContentFlow might not be valid JSON: ${trimmedOutput}`);
      // Depending on strictness, you might throw an error here or let the caller handle it.
      // For now, we return it as is, as per schema.
    }
    return { analysisJsonString: trimmedOutput };
  }
);
