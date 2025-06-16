
import { defineFlow } from '@genkit-ai/flow';
import { z } from 'zod';
import { ai } from '../genkit.js';
import { saveDocumentAnalysis } from '../lib/firebase.js'; // Assuming this will be the new path

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

const DocumentProcessingStatusSchema = z.object({
  fileName: z.string(),
  status: z.enum(['completed', 'error']),
  message: z.string().optional(),
  analysisResult: z.any().optional(), // Parsed JSON result if successful
});
const AnalyzeDocumentBatchServerOutputSchema = z.array(DocumentProcessingStatusSchema);

const AIAnalysisOutputSchema = z.array(
  z.object({
    fileName: z.string().describe('Name of the document file.'),
    analysisResult: z.string().nullable().describe('Analysis result for the document in JSON format, or null if analysis failed or was blocked.'),
    error: z.string().optional().describe('Error message if analysis for this specific document failed.'),
  })
);
type AIAnalysisOutput = z.infer<typeof AIAnalysisOutputSchema>;

export const analyzeDocumentBatchFlow = defineFlow(
  {
    name: 'analyzeDocumentBatchFlow',
    inputSchema: AnalyzeDocumentBatchInputSchema,
    outputSchema: AnalyzeDocumentBatchServerOutputSchema,
  },
  async (input) => {
    const processingStatuses: z.infer<typeof AnalyzeDocumentBatchServerOutputSchema> = [];

    let aiAnalysisOutputs: AIAnalysisOutput;
    try {
      aiAnalysisOutputs = await analyzeDocumentBatchFlowInternal({
        documents: input.documents,
        analysisPrompt: input.analysisPrompt,
      });
    } catch (flowError) {
      console.error("Error in analyzeDocumentBatchFlowInternal:", flowError);
      input.documents.forEach(doc => {
        processingStatuses.push({
          fileName: doc.fileName,
          status: 'error',
          message: flowError instanceof Error ? flowError.message : "Core analysis flow failed.",
        });
      });
      return processingStatuses;
    }

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
        processingStatuses.push({
          fileName: aiDocOutput.fileName,
          status: 'error',
          message: aiDocOutput.error || "AI returned no analysis or it was filtered.",
        });
      }
    }
    return processingStatuses;
  }
);

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
    schema: z.string().nullable(),
  },
  prompt: `Analyze the following document using the provided prompt and return the analysis result in JSON format.

Document Name: {{{fileName}}}
Document Content: {{media url=fileDataUri}}
Analysis Prompt: {{{analysisPrompt}}}`,
});

const analyzeDocumentBatchFlowInternal = ai.defineFlow(
  {
    name: 'analyzeDocumentBatchFlowInternal',
    inputSchema: z.object({
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
          analysisResult: output,
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
