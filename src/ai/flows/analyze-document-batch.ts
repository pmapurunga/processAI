
'use server';

/**
 * @fileOverview This flow analyzes a batch of documents using Documents AI and Gemini AI.
 * The main exported function, `analyzeDocumentBatch`, also handles saving these analyses to Firestore.
 *
 * - analyzeDocumentBatch: Server Action that orchestrates analysis and saving.
 * - AnalyzeDocumentBatchInput: Input type for the analyzeDocumentBatch function.
 * - AnalyzeDocumentBatchServerOutput: Output type for the analyzeDocumentBatch Server Action.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { saveDocumentAnalysis } from '@/lib/firebase'; // Import for saving

// Schema for the input to the Server Action
const AnalyzeDocumentBatchInputSchema = z.object({
  processId: z.string().describe('ID of the process these documents belong to.'),
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

// Schema for the output of the AI analysis part (internal flow)
const AIAnalysisOutputSchema = z.array(
  z.object({
    fileName: z.string().describe('Name of the document file.'),
    analysisResult: z.string().nullable().describe('Analysis result for the document in JSON format, or null if analysis failed or was blocked.'),
    error: z.string().optional().describe('Error message if analysis for this specific document failed.'),
  })
);
type AIAnalysisOutput = z.infer<typeof AIAnalysisOutputSchema>;


// Schema for the output of the Server Action (returned to the client)
const DocumentProcessingStatusSchema = z.object({
  fileName: z.string(),
  status: z.enum(['completed', 'error']),
  message: z.string().optional(),
  analysisResult: z.any().optional(), // Parsed JSON result if successful
});
const AnalyzeDocumentBatchServerOutputSchema = z.array(DocumentProcessingStatusSchema);
export type AnalyzeDocumentBatchServerOutput = z.infer<typeof AnalyzeDocumentBatchServerOutputSchema>;


// This is the main Server Action called by the client
export async function analyzeDocumentBatch(input: AnalyzeDocumentBatchInput): Promise<AnalyzeDocumentBatchServerOutput> {
  const processingStatuses: AnalyzeDocumentBatchServerOutput = [];

  // 1. Perform AI Analysis using the internal flow
  let aiAnalysisOutputs: AIAnalysisOutput;
  try {
    aiAnalysisOutputs = await analyzeDocumentBatchFlowInternal({
      documents: input.documents,
      analysisPrompt: input.analysisPrompt,
    });
  } catch (flowError) {
    console.error("Error in analyzeDocumentBatchFlowInternal:", flowError);
    // If the entire flow fails, mark all documents as errored
    input.documents.forEach(doc => {
      processingStatuses.push({
        fileName: doc.fileName,
        status: 'error',
        message: flowError instanceof Error ? flowError.message : "Core analysis flow failed.",
      });
    });
    return processingStatuses;
  }

  // 2. Save results to Firestore
  for (const aiDocOutput of aiAnalysisOutputs) {
    if (aiDocOutput.analysisResult && !aiDocOutput.error) {
      try {
        const parsedResult = JSON.parse(aiDocOutput.analysisResult);
        await saveDocumentAnalysis(
          input.processId,
          aiDocOutput.fileName,
          input.analysisPrompt,
          parsedResult
        );
        processingStatuses.push({
          fileName: aiDocOutput.fileName,
          status: 'completed',
          message: 'Analyzed and saved successfully.',
          analysisResult: parsedResult,
        });
      } catch (saveError) {
        console.error(`Error saving analysis for ${aiDocOutput.fileName}:`, saveError);
        let message = `Failed to save analysis.`;
        if (saveError instanceof Error && saveError.message.includes("invalid JSON")) {
            message = `AI returned invalid JSON: ${(saveError as Error).message}`;
        } else if (saveError instanceof Error) {
            message = `Save error: ${saveError.message}`;
        }
        processingStatuses.push({
          fileName: aiDocOutput.fileName,
          status: 'error',
          message: message,
        });
      }
    } else {
      // Analysis for this document failed or returned null
      processingStatuses.push({
        fileName: aiDocOutput.fileName,
        status: 'error',
        message: aiDocOutput.error || "AI returned no analysis or it was filtered.",
      });
    }
  }
  return processingStatuses;
}


// Define the prompt for individual document analysis
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
    schema: z.string().nullable(), // AI can return null
  },
  prompt: `Analyze the following document using the provided prompt and return the analysis result in JSON format.\n\nDocument Name: {{{fileName}}}\nDocument Content: {{media url=fileDataUri}}\nAnalysis Prompt: {{{analysisPrompt}}}`,
});


// Internal flow for performing AI analysis on a batch (not directly saving)
const analyzeDocumentBatchFlowInternal = ai.defineFlow(
  {
    name: 'analyzeDocumentBatchFlowInternal',
    inputSchema: z.object({ // Simplified input for this internal flow part
        documents: AnalyzeDocumentBatchInputSchema.shape.documents,
        analysisPrompt: AnalyzeDocumentBatchInputSchema.shape.analysisPrompt,
    }),
    outputSchema: AIAnalysisOutputSchema,
  },
  async (input) => {
    const analysisResultsPromises = input.documents.map(async (document) => {
      try {
        const { output } = await analyzeDocumentPrompt({
          fileName: document.fileName,
          fileDataUri: document.fileDataUri,
          analysisPrompt: input.analysisPrompt,
        });
        return {
          fileName: document.fileName,
          analysisResult: output, // output can be null here
          error: output === null ? "AI returned null or content was filtered." : undefined,
        };
      } catch (err) {
        console.error(`Error analyzing document ${document.fileName} in prompt:`, err);
        return {
          fileName: document.fileName,
          analysisResult: null,
          error: err instanceof Error ? err.message : "Unknown error during AI analysis of this document.",
        };
      }
    });

    return Promise.all(analysisResultsPromises);
  }
);
