
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
 * Extracts text from a document using its byte content.
 * @param fileBytes The byte content of the document as a Uint8Array.
 * @param mimeType The MIME type of the document (e.g., "application/pdf").
 * @returns The extracted text content of the document.
 */
export async function extractTextWithDocumentAI(
  fileBytes: Uint8Array,
  mimeType: string = 'application/pdf'
): Promise<string> {
  console.log(`[Document AI Service] Processing document from bytes. MimeType: ${mimeType}, Size: ${fileBytes.byteLength} bytes`);

  const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;

  const request: google.cloud.documentai.v1.IProcessRequest = {
    name,
    rawDocument: {
      content: fileBytes, // Pass file content directly
      mimeType: mimeType,
    },
    skipHumanReview: true,
  };

  console.log('[Document AI Service] Sending request to Document AI with rawDocument:', 
    JSON.stringify({ name: request.name, rawDocument: { mimeType: request.rawDocument?.mimeType, contentLength: request.rawDocument?.content?.byteLength }, skipHumanReview: request.skipHumanReview }, null, 2)
  );


  try {
    const [result] = await client.processDocument(request);
    const { document } = result;

    if (!document || !document.text) {
      console.warn('[Document AI Service] Document processed but no text extracted.');
      return '';
    }

    console.log(`[Document AI Service] Text extracted successfully from bytes. Length: ${document.text.length}`);
    return document.text;
  } catch (error) {
    console.error('[Document AI Service] Error processing document from bytes:', error);
    // Lançar o erro original para que a action possa capturá-lo com seus detalhes (como 'code')
    throw error; 
  }
}
