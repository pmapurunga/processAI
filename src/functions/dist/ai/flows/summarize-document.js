"use strict";
'use server';
Object.defineProperty(exports, "__esModule", { value: true });
exports.summarizeDocument = summarizeDocument;
/**
 * @fileOverview A document summarization AI agent.
 *
 * - summarizeDocument - A function that handles the document summarization process.
 * - SummarizeDocumentInput - The input type for the summarizeDocument function.
 * - SummarizeDocumentOutput - The return type for the summarizeDocument function.
 */
const genkit_config_1 = require("@/ai/genkit.config"); // Corrected import path
const genkit_1 = require("genkit");
const SummarizeDocumentInputSchema = genkit_1.z.object({
    documentText: genkit_1.z.string().describe('The text content of the document to summarize.'),
});
const SummarizeDocumentOutputSchema = genkit_1.z.object({
    summary: genkit_1.z.string().describe('A concise summary of the document.'),
});
async function summarizeDocument(input) {
    return summarizeDocumentFlow(input);
}
const prompt = genkit_config_1.ai.definePrompt({
    name: 'summarizeDocumentPrompt',
    input: { schema: SummarizeDocumentInputSchema },
    output: { schema: SummarizeDocumentOutputSchema },
    prompt: `You are an expert summarizer, able to create concise and accurate summaries of long documents.

  Please provide a summary of the following document:

  {{{documentText}}}`,
});
const summarizeDocumentFlow = genkit_config_1.ai.defineFlow({
    name: 'summarizeDocumentFlow',
    inputSchema: SummarizeDocumentInputSchema,
    outputSchema: SummarizeDocumentOutputSchema,
}, async (input) => {
    const { output } = await prompt(input);
    return output;
});
//# sourceMappingURL=summarize-document.js.map