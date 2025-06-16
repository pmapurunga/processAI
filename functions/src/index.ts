
import * as admin from 'firebase-admin';
import { onObjectFinalized } from 'firebase-functions/v2/storage';
import { logger } from 'firebase-functions/v2';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { runFlow } from '@genkit-ai/flow';
import { ingestDocumentFlow } from './flows/ingest-document.js';
import { ragChatFlow } from './flows/rag-chat.js';
import { extractSummaryFromPdfFlow } from './flows/extract-summary-from-pdf.js';

admin.initializeApp();

export const triggerDocumentIngestion = onObjectFinalized(
  { cpu: 2, timeoutSeconds: 540, memory: '4GiB' },
  async (event) => {
    const { bucket, name: filePath } = event.data;

    const pathParts = filePath.split('/');
    if (pathParts[0] !== 'uploads' || pathParts.length < 3) {
      logger.warn(`File path ${filePath} is not a valid upload. Skipping.`);
      return;
    }
    const processId = pathParts[1];

    try {
      logger.info(`Triggering ingestion flow for processId: ${processId}`);
      await runFlow(ingestDocumentFlow, {
        filePath: filePath,
        processId: processId,
        bucket: bucket,
      });
      logger.info(`Successfully triggered ingestion for document: ${filePath}`);
    } catch (error) {
      logger.error(`Error processing document ${filePath}:`, error);
    }
  }
);

export const ragChat = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication is required.');
  }
  const { query, processId, history } = request.data;
  if (!query || !processId) {
    throw new HttpsError('invalid-argument', 'Missing "query" or "processId".');
  }
  return await runFlow(ragChatFlow, {
    query,
    processId,
    history: history || [],
  });
});

export const extractSummary = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication is required.');
  }
  const { processId } = request.data;
  if (!processId) {
    throw new HttpsError('invalid-argument', 'Missing "processId".');
  }
  return await runFlow(extractSummaryFromPdfFlow, { processId });
});
