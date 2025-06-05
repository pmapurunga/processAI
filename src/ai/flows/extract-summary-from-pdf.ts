'use server';
/**
 * @fileOverview Extracts the summary and process number from a PDF document using Documents AI.
 *
 * - extractSummaryFromPdf - A function that handles the PDF extraction process.
 * - ExtractSummaryFromPdfInput - The input type for the extractSummaryFromPdf function.
 * - ExtractSummaryFromPdfOutput - The return type for the extractSummaryFromPdf function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExtractSummaryFromPdfInputSchema = z.object({
  pdfDataUri: z
    .string()
    .describe(
      'A PDF document as a data URI that must include a MIME type and use Base64 encoding. Expected format: \'data:<mimetype>;base64,<encoded_data>\'.'      
    ),
});
export type ExtractSummaryFromPdfInput = z.infer<typeof ExtractSummaryFromPdfInputSchema>;

const ExtractSummaryFromPdfOutputSchema = z.object({
  processNumber: z.string().describe('The process number extracted from the PDF.'),
  summary: z.string().describe('The summary extracted from the PDF.'),
});
export type ExtractSummaryFromPdfOutput = z.infer<typeof ExtractSummaryFromPdfOutputSchema>;

export async function extractSummaryFromPdf(input: ExtractSummaryFromPdfInput): Promise<ExtractSummaryFromPdfOutput> {
  return extractSummaryFromPdfFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractSummaryFromPdfPrompt',
  input: {schema: ExtractSummaryFromPdfInputSchema},
  output: {schema: ExtractSummaryFromPdfOutputSchema},
  prompt: `You are an expert legal assistant. Your job is to extract the process number and summary from a PDF document.

  Extract the process number and summary from the following PDF document.  Be as accurate as possible.

  PDF Document: {{media url=pdfDataUri}}`,
});

const extractSummaryFromPdfFlow = ai.defineFlow(
  {
    name: 'extractSummaryFromPdfFlow',
    inputSchema: ExtractSummaryFromPdfInputSchema,
    outputSchema: ExtractSummaryFromPdfOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
