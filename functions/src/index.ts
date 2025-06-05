
import * as functions from "firebase-functions";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK.
if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();
const storageAdmin = admin.storage();

export const helloWorld = functions.https.onRequest((request, response) => {
  logger.info("Hello logs!", {structuredData: true});
  response.send("Hello from Firebase Functions!");
});

export const processUploadedDocumentForAnalysis = functions.storage
  .object()
  .onFinalize(async (object) => {
    const filePath = object.name; // File path in the bucket.
    const contentType = object.contentType; // File content type.
    const bucketName = object.bucket;

    if (!filePath || !contentType) {
      logger.warn("File path or content type missing.", {filePath, contentType});
      return null;
    }

    logger.info(`New file: ${filePath} in ${bucketName}`);

    if (!filePath.startsWith("pendingAnalysis/")) {
      logger.log("File not in pendingAnalysis/, skipping.");
      return null;
    }

    if (!contentType.includes("pdf")) {
      logger.warn(`File ${filePath} is not PDF. Type: ${contentType}.`);
      // Optionally delete non-PDF files.
      // await storageAdmin.bucket(bucketName).file(filePath).delete();
      return null;
    }

    const customMetadata = object.metadata || {};
    const processId = customMetadata.processId;
    const analysisPrompt = customMetadata.analysisPromptUsed;
    const userId = customMetadata.userId;
    const originalName = customMetadata.originalFileName ||
                         filePath.split("/").pop() || "unknown.pdf";

    if (!processId || !analysisPrompt || !userId) {
      logger.error("Missing metadata for file:", {filePath, customMetadata});
      await storageAdmin.bucket(bucketName).file(filePath).delete();
      logger.log(`Deleted ${filePath} (missing metadata).`);
      return null;
    }

    logger.info(`Processing ${originalName} for proc ${processId}`);

    // Simulate AI analysis
    logger.info(`Simulating AI analysis for ${originalName}...`);
    const simulatedJson = {
      IdDocOriginal: originalName.split(".")[0] || "mockId",
      TipoDocOriginal: "Doc (Simulado CF)",
      PoloInferido: "Ativo (Simulado CF)",
      NomeArqOriginal: originalName,
      ResumoGeral: `Resumo simulado do arquivo ${originalName}.`,
      InfoProcessuais: "Info processual CF (simulada).",
      DocsMedicos: [
        {
          TipoDocMedico: "Atestado (Simulado CF)",
          DataDocMedico: new Date().toISOString().split("T")[0],
          Profissional: "Dr. Simulado (CF)",
          ResumoMedico: "Diag. simulado: Condição X (CF).",
          Pagina: "pg 1 (simulado)",
        },
      ],
    };
    logger.info("AI analysis simulation complete.");

    // Save result to Firestore
    try {
      const analysisEntry = {
        processId,
        fileName: originalName,
        analysisPromptUsed: analysisPrompt,
        analysisResultJson: simulatedJson,
        status: "completed" as const,
        uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
        analyzedAt: admin.firestore.FieldValue.serverTimestamp(),
        processedBy: "cloudFunction",
      };

      await db.collection("processes").doc(processId)
        .collection("documentAnalyses").add(analysisEntry);
      logger.info(`Analysis for ${originalName} saved for ${processId}.`);

      // Update parent process status
      await db.collection("processes").doc(processId).set({
        status: "documents_completed", // Or "chat_ready"
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, {merge: true});
      logger.info(`Process ${processId} status updated.`);

    } catch (error) {
      logger.error(
        `Error saving analysis for ${originalName} to Firestore:`,
        error
      );
      // Do not delete file from Storage if Firestore save fails,
      // to allow for retry or debugging.
      return null;
    }

    // Delete file from Storage after successful processing
    try {
      await storageAdmin.bucket(bucketName).file(filePath).delete();
      logger.info(
        `Processed and deleted ${filePath} from Storage.`
      );
    } catch (error) {
      logger.error(`Error deleting ${filePath} from Storage:`, error);
      // Even if deletion fails, analysis was saved.
    }

    return null;
  });
