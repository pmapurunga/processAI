'use server';

/**
 * @fileOverview This flow analyzes a batch of documents using Documents AI and Gemini AI,
 * and stores the analysis of each document in JSON format.
 *
 * - analyzeDocumentBatch: Analyzes a batch of documents.
 * - AnalyzeDocumentBatchInput: Input type for the analyzeDocumentBatch function.
 * - AnalyzeDocumentBatchOutput: Output type for the analyzeDocumentBatch function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Define schemas for input and output
const AnalyzeDocumentBatchInputSchema = z.object({
  documents: z.array(
    z.object({
      fileName: z.string().describe('Name of the document file.'),
      fileDataUri: z
        .string()
        .describe(
          "The document's data URI, which must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
        ),
    })
  ).describe('Array of documents to analyze, each with a file name and data URI.'),
  analysisPrompt: z
    .string()
    .describe('Prompt to guide the analysis of each document.'),
});
export type AnalyzeDocumentBatchInput = z.infer<typeof AnalyzeDocumentBatchInputSchema>;

const AnalyzeDocumentBatchOutputSchema = z.array(
  z.object({
    fileName: z.string().describe('Name of the document file.'),
    analysisResult: z.string().describe('Analysis result for the document in JSON format.'),
  })
);
export type AnalyzeDocumentBatchOutput = z.infer<typeof AnalyzeDocumentBatchOutputSchema>;

// Exported function to call the flow
export async function analyzeDocumentBatch(input: AnalyzeDocumentBatchInput): Promise<AnalyzeDocumentBatchOutput> {
  return analyzeDocumentBatchFlow(input);
}

// Define the prompt
const analyzeDocumentPrompt = ai.definePrompt({
  name: 'analyzeDocumentPrompt',
  input: {
    schema: z.object({
      fileName: z.string(),
      fileDataUri: z.string(),
      analysisPrompt: z.string(),
    }),
  },
  output: {
    schema: z.string(),
  },
  prompt: `Analyze the following document using the provided prompt and return the analysis result in JSON format.\n\nDocument Name: {{{fileName}}}\nDocument Content: {{media url=fileDataUri}}\nAnalysis Prompt: {{{analysisPrompt}}}`,
});

// Define the flow
const analyzeDocumentBatchFlow = ai.defineFlow(
  {
    name: 'analyzeDocumentBatchFlow',
    inputSchema: AnalyzeDocumentBatchInputSchema,
    outputSchema: AnalyzeDocumentBatchOutputSchema,
  },
  async input => {
    const analysisResults: { fileName: string; analysisResult: string }[] = [];

    for (const document of input.documents) {
      const {output} = await analyzeDocumentPrompt({
        fileName: document.fileName,
        fileDataUri: document.fileDataUri,
        analysisPrompt: input.analysisPrompt,
      });

      analysisResults.push({
        fileName: document.fileName,
        analysisResult: output!,
      });
    }

    return analysisResults;
  }
);
