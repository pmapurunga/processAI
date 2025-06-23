
import { onObjectFinalized } from "firebase-functions/v2/storage";
import * as admin from "firebase-admin";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import { google } from '@google-cloud/documentai/build/protos/protos';
import { textEmbeddingGecko001 } from '@genkit-ai/googleai';
import { summarizeDocument } from './ai-flows/summarize-document';
import { ai } from './genkit.config';

try {
  admin.initializeApp();
} catch (e) {
  if ((e as any).code !== "app/duplicate-app") {
    console.error("Firebase admin initialization error", e);
  }
}

const db = getFirestore();
const storage = admin.storage();

export const processDocumentAIRecognitionV2 = onObjectFinalized(
  {
    timeoutSeconds: 540,
    memory: "2GiB",
    cpu: 1,
    secrets: ["GEMINI_API_KEY"],
  },
  async (event) => {
    const { name: filePath, bucket: bucketName } = event.data;

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

      await new Promise(resolve => setTimeout(resolve, 5000));

      const [files] = await storage
        .bucket(bucketName)
        .getFiles({ prefix: `results/${documentId}/` });
      const jsonFiles = files.filter((f) => f.name.endsWith(".json"));

      if (jsonFiles.length === 0) {
          throw new Error("No JSON result files found after claiming the document.");
      }

      let fullText = "";
      for (const file of jsonFiles) {
        const [fileContent] = await file.download();
        const document = JSON.parse(fileContent.toString()) as google.cloud.documentai.v1.IDocument;
        fullText += document.text || "";
      }

      if (!fullText) {
        throw new Error("Extracted text is empty.");
      }

      await docRef.update({
        internalStatus: "embedding",
        extractedText: fullText,
        updatedAt: Timestamp.now(),
      });

      const embedding = await ai.embed({
        embedder: textEmbeddingGecko001,
        content: fullText,
      });

      await docRef.collection("embeddings").doc("full_document").set({
        documentId,
        embedding,
      });

      await docRef.update({
        internalStatus: "summarization_started",
        updatedAt: Timestamp.now(),
      });

      const { summary } = await summarizeDocument({ documentText: fullText });

      await docRef.update({
        status: "processed",
        internalStatus: "completed",
        summary: summary || "Could not generate a summary.",
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
  }
);
