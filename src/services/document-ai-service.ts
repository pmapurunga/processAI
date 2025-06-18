
'use server';

import {
  DocumentProcessorServiceClient
} from '@google-cloud/documentai';
import type { google } from '@google-cloud/documentai/build/protos/protos';

// Ensure these environment variables are set
const projectId = process.env.GCP_PROJECT_ID;
const location = process.env.DOCUMENT_AI_LOCATION; // e.g. 'us' or 'eu'
const processorId = process.env.DOCUMENT_AI_PROCESSOR_ID;

if (!projectId || !location || !processorId) {
  throw new Error(
    'Missing GCP_PROJECT_ID, DOCUMENT_AI_LOCATION, or DOCUMENT_AI_PROCESSOR_ID environment variables for Document AI Service'
  );
}

const client = new DocumentProcessorServiceClient();

/**
 * Extracts text from a document stored in GCS using Document AI.
 * @param gcsUri The GCS URI of the document (e.g., "gs://bucket-name/path/to/file.pdf").
 * @param mimeType The MIME type of the document (e.g., "application/pdf").
 * @returns The extracted text content of the document.
 */
export async function extractTextWithDocumentAI(
  gcsUri: string,
  mimeType: string = 'application/pdf'
): Promise<string> {
  console.log(`[Document AI Service] Processing document: ${gcsUri}`);

  const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;

  const request: google.cloud.documentai.v1.IProcessRequest = {
    name,
    gcsDocument: {
      gcsUri: gcsUri,
      mimeType: mimeType,
    },
    // Optionally, skip human review for this example.
    // For production, you might want to configure human review.
    skipHumanReview: true,
  };

  console.log('[Document AI Service] Sending request to Document AI:', JSON.stringify(request, null, 2));

  try {
    const [result] = await client.processDocument(request);
    const { document } = result;

    if (!document || !document.text) {
      console.warn('[Document AI Service] Document processed but no text extracted.');
      return '';
    }

    console.log(`[Document AI Service] Text extracted successfully for ${gcsUri}. Length: ${document.text.length}`);
    return document.text;
  } catch (error) {
    console.error('[Document AI Service] Error processing document:', error);
    throw new Error(`Failed to process document with Document AI: ${error instanceof Error ? error.message : String(error)}`);
  }
}
