import { getStorage } from 'firebase-admin/storage';
import { onObjectFinalized } from 'firebase-functions/v2/storage';
import { getFirestore } from 'firebase-admin/firestore';
import * as path from 'path';

import { ingestDocumentFlow } from '../../src/ai/flows/ingest-document';
import { initializeGenkit } from '../../src/ai/genkit';
import { logger } from 'firebase-functions/v2';

const pdf = require('pdf-parse');
const { ImageAnnotatorClient } = require('@google-cloud/vision');

initializeGenkit();

async function extractTextFromPdf(
  filePath: string,
  bucketName: string
): Promise<string> {
  const bucket = getStorage().bucket(bucketName);
  const file = bucket.file(filePath);
  const fileBuffer = (await file.download())[0];

  // Try parsing text directly
  const pdfData = await pdf(fileBuffer);
  if (pdfData.text) {
    logger.info('Extracted text directly from PDF.');
    return pdfData.text;
  }

  // If no text, assume it's an image-based PDF and use OCR
  logger.info(
    'No text found directly, proceeding with OCR using Google Cloud Vision.'
  );
  const client = new ImageAnnotatorClient();
  const [result] = await client.batchAnnotateFiles({
    requests: [
      {
        inputConfig: {
          gcsSource: {
            uri: `gs://${bucketName}/${filePath}`,
          },
          mimeType: 'application/pdf',
        },
        features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
      },
    ],
  });

  const fullText =
    result.responses[0]?.fullTextAnnotation?.text ||
    'Could not extract text from PDF.';
  logger.info('Extracted text using OCR.');
  return fullText;
}

export const ingestDocument = onObjectFinalized(
  {
    cpu: 2,
    memory: '1GiB',
    timeoutSeconds: 1800,
  },
  async (event) => {
    const { bucket, name: filePath } = event.data;
    const processId = path.basename(path.dirname(filePath));

    try {
      logger.info(`Starting ingestion for processId: ${processId}...`);

      const text = await extractTextFromPdf(filePath, bucket);

      logger.info('Running Genkit flow to generate embeddings...');
      await ingestDocumentFlow.run({
        text,
        processId,
      });

      logger.info(`Finished ingestion for processId: ${processId}.`);

      await getFirestore()
        .collection('processes')
        .doc(processId)
        .update({ status: 'processed' });
    } catch (error) {
      logger.error('Error during document ingestion:', error);
      await getFirestore()
        .collection('processes')
        .doc(processId)
        .update({ status: 'error', error: (error as Error).message });
    }
  }
);