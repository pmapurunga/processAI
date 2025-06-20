
// This is a self-contained service file for the Cloud Function.
// It does not use 'use server' or any Next.js-specific features.

import { DocumentProcessorServiceClient } from '@google-cloud/documentai';
import type { google } from '@google-cloud/documentai/build/protos/protos';
import * as functions from 'firebase-functions';

// These should be set as environment variables on the Cloud Function
const projectId = functions.config().gcp.project_id;
const location = functions.config().document_ai.location;
const processorId = functions.config().document_ai.processor_id;

const client = new DocumentProcessorServiceClient();

/**
 * Initiates a batch (asynchronous) processing job for a large document.
 *
 * @param gcsInputUri The GCS URI of the document to process.
 * @param gcsOutputUri The GCS URI where the output JSON should be stored.
 * @param mimeType The MIME type of the document.
 * @returns The promise of a long-running operation.
 */
export async function startBatchDocumentProcessing(
  gcsInputUri: string,
  gcsOutputUri: string,
  mimeType: string
) {
  if (!projectId || !location || !processorId) {
    const errorMsg = 'Missing environment variables for Document AI Service in the Cloud Function environment.';
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;

  // Configure the batch process request
  const request: google.cloud.documentai.v1.IBatchProcessRequest = {
    name,
    inputDocuments: {
      gcsDocuments: {
        documents: [
          {
            gcsUri: gcsInputUri,
            mimeType,
          },
        ],
      },
    },
    documentOutputConfig: {
      // Corrected property name from gcsConfig to gcsOutputConfig
      gcsOutputConfig: {
        gcsUri: gcsOutputUri,
      },
    },
    skipHumanReview: true,
  };

  try {
    console.log('[Function] Starting batch processing job with request:', JSON.stringify(request, null, 2));
    const [operation] = await client.batchProcessDocuments(request);
    console.log(`[Function] Batch processing job created. Operation name: ${operation.name}`);
    return operation;
  } catch (error: any) {
    console.error('[Function] Error starting batch processing job:', error);
    const errorMessage = error.details || (error instanceof Error ? error.message : String(error));
    throw new Error(`Failed to start batch processing job: ${errorMessage}`);
  }
}
