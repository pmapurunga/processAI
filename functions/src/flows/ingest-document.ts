
import { text } from 'pdf-parse';
import { getStorage } from 'firebase-admin/storage';
import { getFirestore } from 'firebase-admin/firestore';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import { IndexServiceClient } from '@google-cloud/aiplatform';
import { embed } from '@genkit-ai/ai';
import { textEmbedding004 } from '@genkit-ai/googleai';
import * as admin from 'firebase-admin';
import { defineFlow } from '@genkit-ai/flow';
import * as z from 'zod';

// Initialize Firebase and other clients
const firestore = getFirestore();
const visionClient = new ImageAnnotatorClient();
const indexServiceClient = new IndexServiceClient();

// Configuration for Vertex AI Vector Search from environment variables
const project = process.env.GCP_PROJECT;
const location = process.env.GCP_LOCATION;
const indexId = process.env.VERTEX_INDEX_ID;

if (!project || !location || !indexId) {
  throw new Error(
    'Missing Vertex AI environment variables. Please set GCP_PROJECT, GCP_LOCATION, and VERTEX_INDEX_ID.'
  );
}

interface Datapoint {
    datapoint_id: string;
    feature_vector: number[];
}

// Define the schema for the document ingestion flow
export const ingestDocumentFlow = defineFlow(
  {
    name: 'ingestDocument',
    inputSchema: z.object({
      filePath: z.string(),
      processId: z.string(),
      bucket: z.string(),
    }),
    outputSchema: z.void(),
  },
  async (input) => {
    const { filePath, processId, bucket } = input;
    const file = getStorage().bucket(bucket).file(filePath);

    const [fileBuffer] = await file.download();

    // 1. Extract text using OCR or text extraction
    let extractedText = '';
    const pdfData = await text(fileBuffer);

    if (pdfData.text.trim().length > 0) {
      extractedText = pdfData.text;
    } else {
      const [result] = await visionClient.documentTextDetection(fileBuffer);
      extractedText = result.fullTextAnnotation?.text ?? '';
    }

    // 2. Chunk the extracted text
    const chunks = chunkText(extractedText);

    // 3. Generate embeddings for each chunk
    const embeddingsResponse = await embed({
        embedder: textEmbedding004,
        content: chunks,
    });
    const embeddings = embeddingsResponse.embeddings.map(e => e.embedding);


    // 4. Store text chunks in Firestore and prepare vectors for upload
    const batch = firestore.batch();
    const datapoints: Datapoint[] = [];
    chunks.forEach((chunk, index) => {
      const chunkId = `${processId}_${Date.now()}_${index}`;
      const docRef = firestore.collection('processes').doc(processId).collection('chunks').doc(chunkId);
      batch.set(docRef, {
        text: chunk,
        processId: processId,
        chunkId: chunkId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      datapoints.push({
        datapoint_id: chunkId,
        feature_vector: embeddings[index],
      });
    });

    await batch.commit();

    // 5. Upsert vectors to Vertex AI Vector Search Index
    const indexName = indexServiceClient.indexPath(project, location, indexId);
    await indexServiceClient.upsertDatapoints({
      index: indexName,
      datapoints: datapoints,
    });

    // 6. Update the process status in Firestore
    await firestore.collection('processes').doc(processId).update({
      status: 'processed_and_indexed',
    });
  }
);

function chunkText(text: string, chunkSize = 1000, overlap = 200): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    const end = Math.min(i + chunkSize, text.length);
    chunks.push(text.substring(i, end));
    i += chunkSize - overlap;
    if (end === text.length) break;
  }
  return chunks;
}
