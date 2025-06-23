
import { defineFlow, onFlow } from '@genkit-ai/flow';
import { z } from 'zod';
import { geminiPro } from '@genkit-ai/googleai';
import { DocumentData, DocumentReference } from 'firebase-admin/firestore';

// Define the input schema for the document summarization flow
export const SummarizeDocumentInputSchema = z.object({
  documentText: z.string().describe('The text content of the document to summarize.'),
});
export type SummarizeDocumentInput = z.infer<typeof SummarizeDocumentInputSchema>;

// Define the output schema for the document summarization flow
export const SummarizeDocumentOutputSchema = z.object({
  summary: z.string().describe('A concise summary of the document.'),
});
export type SummarizeDocumentOutput = z.infer<typeof SummarizeDocumentOutputSchema>;

// Define the document summarization flow
export const summarizeDocumentFlow = defineFlow(
  {
    name: 'summarizeDocumentFlow',
    inputSchema: SummarizeDocumentInputSchema,
    outputSchema: SummarizeDocumentOutputSchema,
  },
  async (input: SummarizeDocumentInput) => {
    const { documentText } = input;

    const prompt = `You are an expert summarizer, able to create concise and accurate summaries of long documents.

    Please provide a summary of the following document:
  
    ${documentText}`;

    const llmResponse = await geminiPro.generate({
      prompt,
    });

    return {
      summary: llmResponse.text(),
    };
  }
);

// Export the flow as a Firebase Function
export const summarizeDocument = onFlow(summarizeDocumentFlow, {
  name: 'summarize-document',
  https: {
    // These are the new v2 options
    concurrency: 1, // Max concurrent requests per instance
    timeoutSeconds: 600, // Request timeout in seconds
    memory: '1GiB', // Memory allocation
    cpu: 1, // CPU allocation
  },
  // Define any required secrets
  secrets: ['GEMINI_API_KEY'],
});
