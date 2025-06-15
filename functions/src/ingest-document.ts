
import { defineFlow } from "@genkit-ai/flow";
import * as z from "zod";
import { getStorage } from "firebase-admin/storage";
import { getFirestore } from "firebase-admin/firestore";
import { DocumentProcessorServiceClient } from "@google-cloud/documentai";
import { IndexServiceClient } from "@google-cloud/aiplatform";
import { embed } from "@genkit-ai/ai";
import { textEmbedding004 } from "@genkit-ai/googleai";
import * as admin from "firebase-admin";
import { ai } from "./ai";

// Initialize Firebase and Google Cloud clients
const firestore = getFirestore();
const documentAiClient = new DocumentProcessorServiceClient();
const indexServiceClient = new IndexServiceClient();

// Get configuration from environment variables
const project = process.env.GCP_PROJECT;
const location = process.env.GCP_LOCATION || "us-central1";
const indexId = process.env.VECTOR_SEARCH_INDEX_ID;
const processorId = process.env.DOCUMENT_AI_PROCESSOR_ID;

// Define the schema for the document ingestion flow
export const ingestDocumentFlow = defineFlow(
  {
    name: "ingestDocument",
    inputSchema: z.object({
      filePath: z.string(),
      processId: z.string(),
    }),
    outputSchema: z.void(),
  },
  async (input) => {
    // 1. Validate environment variables
    if (!project || !indexId || !processorId) {
      throw new Error(
        "Missing required environment variables: GCP_PROJECT, VECTOR_SEARCH_INDEX_ID, DOCUMENT_AI_PROCESSOR_ID",
      );
    }

    const { filePath, processId } = input;
    const bucket = getStorage().bucket();
    const file = bucket.file(filePath);
    const [fileBuffer] = await file.download();

    // 2. Extract text using Google Cloud Document AI
    console.log(`Processing document with Document AI Processor: ${processorId}`);
    const name = `projects/${project}/locations/${location}/processors/${processorId}`;
    const request = {
      name,
      rawDocument: {
        content: fileBuffer,
        mimeType: "application/pdf",
      },
    };
    const [result] = await documentAiClient.processDocument(request);
    const { document } = result;
    const extractedText = document?.text ?? "";
    console.log("Document AI processing complete. Text extracted.");

    // 3. Chunk the extracted text respecting paragraphs
    const chunks = chunkText(extractedText, 1000, 200);
    console.log(`Text chunked into ${chunks.length} parts.`);

    // 4. Generate embeddings for each chunk
    // Corrected the type for the 'embed' function input
    const contentForEmbedding = chunks.map(chunk => ({ text: chunk }));
    const embeddings = await embed(ai, {
      model: textEmbedding004,
      content: contentForEmbedding,
    });
    console.log("Embeddings generated for all chunks.");

    // 5. Store text chunks in Firestore and prepare vectors for upload
    const batch = firestore.batch();
    const datapoints: any[] = [];
    chunks.forEach((chunk, index) => {
      const chunkId = `${processId}_${Date.now()}_${index}`;
      const docRef = firestore
        .collection("processes")
        .doc(processId)
        .collection("chunks")
        .doc(chunkId);
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
    console.log("Text chunks saved to Firestore.");

    // 6. Upsert vectors to Vertex AI Vector Search Index
    const indexName = indexServiceClient.indexPath(project, location, indexId);
    await indexServiceClient.upsertDatapoints({
      index: indexName,
      datapoints: datapoints,
    });
    console.log("Vectors upserted to Vertex AI Vector Search.");

    // 7. Update the process status in Firestore
    await firestore.collection("processes").doc(processId).update({
      status: "processed_and_indexed",
    });
    console.log("Process status updated to 'processed_and_indexed'.");
  },
);

/**
 * Splits text into chunks of a specified size, trying to respect paragraph boundaries.
 * @param text The input text.
 * @param chunkSize The target size for each chunk.
 * @param overlap The number of characters to overlap between chunks.
 * @returns An array of text chunks.
 */
function chunkText(
  text: string,
  chunkSize: number,
  overlap: number,
): string[] {
  const doubleNewline = String.fromCharCode(10) + String.fromCharCode(10);
  const paragraphs = text.split(doubleNewline).filter((p) => p.trim().length > 0);
  const chunks: string[] = [];
  let currentChunk = "";

  for (const paragraph of paragraphs) {
    const separator = currentChunk ? doubleNewline : "";
    if ((currentChunk.length + separator.length + paragraph.length) > chunkSize) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
      }
      currentChunk = paragraph;
    } else {
      currentChunk += separator + paragraph;
    }
  }
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  const finalChunks: string[] = [];
  for (const chunk of chunks) {
    if (chunk.length > chunkSize) {
      let i = 0;
      while (i < chunk.length) {
        const end = Math.min(i + chunkSize, chunk.length);
        finalChunks.push(chunk.substring(i, end));
        i += chunkSize - overlap;
        if (end === chunk.length) break;
      }
    } else {
      finalChunks.push(chunk);
    }
  }

  return finalChunks;
}
