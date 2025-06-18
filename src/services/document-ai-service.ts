
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
 * Extracts text from a document in GCS using its URI.
 * @param gcsDocumentUri The GCS URI of the document (e.g., "gs://bucket-name/path/to/document.pdf").
 * @param mimeType The MIME type of the document (e.g., "application/pdf").
 * @returns The extracted text content of the document.
 */
export async function extractTextWithDocumentAI(
  gcsDocumentUri: string,
  mimeType: string = 'application/pdf'
): Promise<string> {
  console.log(`[Document AI Service] Processing document: ${gcsDocumentUri}`);

  const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;

  const request: google.cloud.documentai.v1.IProcessRequest = {
    name,
    gcsDocument: { // Using gcsDocument for reading directly from GCS
      gcsUri: gcsDocumentUri,
      mimeType: mimeType,
    },
    skipHumanReview: true,
  };

  console.log('[Document AI Service] Sending request to Document AI:', 
    JSON.stringify(request, null, 2)
  );

  try {
    const [result] = await client.processDocument(request);
    const { document } = result;

    if (!document || !document.text) {
      console.warn('[Document AI Service] Document processed but no text extracted.');
      return '';
    }

    console.log(`[Document AI Service] Text extracted successfully from GCS URI. Length: ${document.text.length}`);
    return document.text;
  } catch (error: any) {
    console.error('[Document AI Service] Error processing document:', error);
    // Lançar o erro original para que a action possa capturá-lo com seus detalhes (como 'code')
    // Adicionando mais detalhes ao erro lançado, se disponíveis
    const errorMessage = error.details || (error instanceof Error ? error.message : String(error));
    const errorCode = error.code || 'UNKNOWN_CODE';
    throw new Error(`Failed to process document with Document AI: ${errorCode} ${errorMessage}`);
  }
}
