
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { ObjectMetadata } from 'firebase-functions/v1/storage';
import { google } from '@google-cloud/documentai/build/protos/protos';
import { textEmbeddingGecko001 } from '@genkit-ai/googleai';

// Local, self-contained imports
import { summarizeDocument } from '../ai/flows/summarize-document';
import { startBatchDocumentProcessing } from './document-ai';
import { ai } from '../ai/genkit';

// Initialize the Firebase Admin SDK
try {
  admin.initializeApp();
} catch (e) {
  // SDK already initialized
}

const db = getFirestore();
const storage = admin.storage();

// Helper function for text splitting
function splitTextIntoChunks(text: string, chunkSize: number, chunkOverlap: number): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    const end = Math.min(i + chunkSize, text.length);
    chunks.push(text.substring(i, end));
    i += chunkSize - chunkOverlap;
  }
  return chunks;
}


export const processDocumentOnUpload = functions
  .runWith({
    timeoutSeconds: 540,
    memory: "2GB",
  })
  .storage.object()
  .onFinalize(async (object: ObjectMetadata) => {
    const { name: filePath, contentType, bucket: bucketName } = object;

    // Validate if the file is a PDF in the 'uploads/' folder
    if (
      !filePath ||
      !filePath.startsWith("uploads/") ||
      contentType !== "application/pdf"
    ) {
      console.log(
        `File ${filePath} is not a PDF in the 'uploads/' folder. Skipping.`
      );
      return;
    }

    // Extract the document ID from the file path
    const pathParts = filePath.split("/");
    const documentId = pathParts[pathParts.length - 2];
    const docRef = db.collection("documents").doc(documentId);

    try {
      // Set the initial status in Firestore
      await docRef.update({
        status: "processing",
        internalStatus: "batch_document_ai_started",
        updatedAt: Timestamp.now(),
      });

      // Start the batch processing job
      const gcsInputUri = `gs://${bucketName}/${filePath}`;
      const gcsOutputUri = `gs://${bucketName}/results/${documentId}/`;
      await startBatchDocumentProcessing(gcsInputUri, gcsOutputUri, contentType);

      console.log(
        `[${documentId}] Successfully initiated batch processing job.`
      );
    } catch (error: any) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "An unknown error occurred.";
      console.error(
        `[${documentId}] Error initiating batch processing:`,
        error
      );
      await docRef.update({
        status: "error",
        internalStatus: "batch_document_ai_failed",
        errorMessage: errorMessage,
        updatedAt: Timestamp.now(),
      });
    }
  });

export const processDocumentAIRecognition = functions
  .runWith({
    timeoutSeconds: 540,
    memory: "2GB",
    secrets: ["GEMINI_API_KEY"]
  })
  .storage.object()
  .onFinalize(async (object: ObjectMetadata) => {
    const { name: filePath, bucket: bucketName } = object;

    // Validate if the file is a JSON in the 'results/' folder
    if (
      !filePath ||
      !filePath.startsWith("results/") ||
      !filePath.endsWith(".json")
    ) {
      console.log(
        `File ${filePath} is not a JSON file in the 'results/' folder. Skipping.`
      );
      return;
    }

    // Extract the document ID from the file path
    const pathParts = filePath.split("/");
    const documentId = pathParts[1];
    const docRef = db.collection("documents").doc(documentId);

    try {
      let shouldProcess = false;
      await db.runTransaction(async (transaction) => {
        const docSnapshot = await transaction.get(docRef);
        if (docSnapshot.exists && docSnapshot.data()?.internalStatus === "batch_document_ai_started") {
          transaction.update(docRef, {
            internalStatus: "parsing_document_ai_result",
            updatedAt: Timestamp.now(),
          });
          shouldProcess = true;
        }
      });

      if (!shouldProcess) {
        console.log(`[${documentId}] Document not in processable state or already claimed by another function instance. Skipping.`);
        return;
      }

      // Add a brief delay to allow all GCS files to be finalized.
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Fetch all result files for this job
      const [files] = await storage
        .bucket(bucketName)
        .getFiles({ prefix: `results/${documentId}/` });
      const jsonFiles = files.filter((f) => f.name.endsWith(".json"));

      if (jsonFiles.length === 0) {
          throw new Error("No JSON result files found after claiming the document.");
      }

      // Process all JSON files
      let fullText = "";
      for (const file of jsonFiles) {
        const [fileContent] = await file.download();
        const document = JSON.parse(fileContent.toString()) as google.cloud.documentai.v1.IDocument;
        fullText += document.text || "";
      }

      if (!fullText) {
        throw new Error("Extracted text is empty.");
      }

      // Update Firestore with the extracted text
      await docRef.update({
        internalStatus: "chunking_and_embedding",
        extractedText: fullText,
        updatedAt: Timestamp.now(),
      });

      // Split the text, create embeddings, and batch write to Firestore
      const textChunks = splitTextIntoChunks(fullText, 1000, 150);
      const batch = db.batch();
      for (let i = 0; i < textChunks.length; i++) {
        const chunkText = textChunks[i];
        const chunkId = `chunk-${i}`;
        const embedding = await ai.embed({
            embedder: textEmbeddingGecko001,
            content: chunkText,
        });
        batch.set(docRef.collection("chunks").doc(chunkId), {
          documentId,
          chunkId,
          text: chunkText,
        });
        batch.set(docRef.collection("embeddings").doc(chunkId), {
          documentId,
          chunkId,
          vector: embedding,
        });
      }
      await batch.commit();

      // Update the status to indicate summarization has started
      await docRef.update({
        internalStatus: "summarization_started",
        updatedAt: Timestamp.now(),
      });

      // Generate the summary
      const { summary } = await summarizeDocument({ documentText: fullText });

      // Set the final status in Firestore
      await docRef.update({
        status: "processed",
        internalStatus: "completed",
        summary: summary || "Could not generate a summary.",
        chunkCount: textChunks.length,
        updatedAt: Timestamp.now(),
        errorMessage: FieldValue.delete(),
      });

      console.log(
        `[${documentId}] Successfully processed and summarized document.`
            );
    } catch (error: any) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "An unknown error occurred during finalization.";
      console.error(`[${documentId}] Error finalizing processing:`, error);
      await docRef.update({
        status: "error",
        internalStatus: "result_handling_failed",
        errorMessage: errorMessage,
        updatedAt: Timestamp.now(),
      });
    }
  });
