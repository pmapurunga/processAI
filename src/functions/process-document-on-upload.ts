
import { onObjectFinalized } from "firebase-functions/v2/storage";
import * as admin from "firebase-admin";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { ObjectMetadata } from "firebase-functions/v1/storage";
import { startBatchDocumentProcessing } from "./document-ai";

try {
  admin.initializeApp();
} catch (e) {
  if ((e as any).code !== "app/duplicate-app") {
    console.error("Firebase admin initialization error", e);
  }
}

const db = getFirestore();

export const processDocumentOnUploadV2 = onObjectFinalized(
  {
    timeoutSeconds: 540,
    memory: "2GiB",
    cpu: 1,
  },
  async (event) => {
    const { name: filePath, contentType, bucket: bucketName } = event.data;

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
  }
);
