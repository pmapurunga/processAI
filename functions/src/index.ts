
import { onObjectFinalized } from "firebase-functions/v2/storage";
import { ingestDocumentFlow } from "./ingest-document";
import * as admin from "firebase-admin";

admin.initializeApp();

export const triggerDocumentIngestion = onObjectFinalized(
  { cpu: 2, timeoutSeconds: 540, memory: "4GiB" },
  async (event) => {
    const { name } = event.data;

    // Assumes the file path is in the format: uploads/{processId}/{fileName}
    const pathParts = name.split("/");
    if (pathParts[0] !== "uploads" || pathParts.length < 3) {
      console.log(`File path ${name} is not a valid upload.`);
      return;
    }

    const processId = pathParts[1];

    try {
      await ingestDocumentFlow.run({
        filePath: name,
        processId: processId,
      });
      console.log(`Successfully processed document: ${name}`);
    } catch (error) {
      console.error(`Error processing document ${name}:`, error);
    }
  },
);
