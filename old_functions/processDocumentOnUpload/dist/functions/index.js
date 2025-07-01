"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.processDocumentAIRecognition = exports.processDocumentOnUpload = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const googleai_1 = require("@genkit-ai/googleai");
// Local, self-contained imports
const summarize_document_1 = require("../ai/flows/summarize-document");
const document_ai_1 = require("./document-ai");
const genkit_1 = require("../ai/genkit");
// Initialize the Firebase Admin SDK
try {
    admin.initializeApp();
}
catch (e) {
    // SDK already initialized
}
const db = (0, firestore_1.getFirestore)();
const storage = admin.storage();
// Helper function for text splitting
function splitTextIntoChunks(text, chunkSize, chunkOverlap) {
    const chunks = [];
    let i = 0;
    while (i < text.length) {
        const end = Math.min(i + chunkSize, text.length);
        chunks.push(text.substring(i, end));
        i += chunkSize - chunkOverlap;
    }
    return chunks;
}
exports.processDocumentOnUpload = functions
    .runWith({
    timeoutSeconds: 540,
    memory: "2GB",
})
    .storage.object()
    .onFinalize(async (object) => {
    const { name: filePath, contentType, bucket: bucketName } = object;
    // Validate if the file is a PDF in the 'uploads/' folder
    if (!filePath ||
        !filePath.startsWith("uploads/") ||
        contentType !== "application/pdf") {
        console.log(`File ${filePath} is not a PDF in the 'uploads/' folder. Skipping.`);
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
            updatedAt: firestore_1.Timestamp.now(),
        });
        // Start the batch processing job
        const gcsInputUri = `gs://${bucketName}/${filePath}`;
        const gcsOutputUri = `gs://${bucketName}/results/${documentId}/`;
        await (0, document_ai_1.startBatchDocumentProcessing)(gcsInputUri, gcsOutputUri, contentType);
        console.log(`[${documentId}] Successfully initiated batch processing job.`);
    }
    catch (error) {
        const errorMessage = error instanceof Error
            ? error.message
            : "An unknown error occurred.";
        console.error(`[${documentId}] Error initiating batch processing:`, error);
        await docRef.update({
            status: "error",
            internalStatus: "batch_document_ai_failed",
            errorMessage: errorMessage,
            updatedAt: firestore_1.Timestamp.now(),
        });
    }
});
exports.processDocumentAIRecognition = functions
    .runWith({
    timeoutSeconds: 540,
    memory: "2GB",
    secrets: ["GEMINI_API_KEY"]
})
    .storage.object()
    .onFinalize(async (object) => {
    const { name: filePath, bucket: bucketName } = object;
    // Validate if the file is a JSON in the 'results/' folder
    if (!filePath ||
        !filePath.startsWith("results/") ||
        !filePath.endsWith(".json")) {
        console.log(`File ${filePath} is not a JSON file in the 'results/' folder. Skipping.`);
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
                    updatedAt: firestore_1.Timestamp.now(),
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
            const document = JSON.parse(fileContent.toString());
            fullText += document.text || "";
        }
        if (!fullText) {
            throw new Error("Extracted text is empty.");
        }
        // Update Firestore with the extracted text
        await docRef.update({
            internalStatus: "chunking_and_embedding",
            extractedText: fullText,
            updatedAt: firestore_1.Timestamp.now(),
        });
        // Split the text, create embeddings, and batch write to Firestore
        const textChunks = splitTextIntoChunks(fullText, 1000, 150);
        const batch = db.batch();
        for (let i = 0; i < textChunks.length; i++) {
            const chunkText = textChunks[i];
            const chunkId = `chunk-${i}`;
            const embedding = await genkit_1.ai.embed({
                embedder: googleai_1.textEmbeddingGecko001,
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
            updatedAt: firestore_1.Timestamp.now(),
        });
        // Generate the summary
        const { summary } = await (0, summarize_document_1.summarizeDocument)({ documentText: fullText });
        // Set the final status in Firestore
        await docRef.update({
            status: "processed",
            internalStatus: "completed",
            summary: summary || "Could not generate a summary.",
            chunkCount: textChunks.length,
            updatedAt: firestore_1.Timestamp.now(),
            errorMessage: firestore_1.FieldValue.delete(),
        });
        console.log(`[${documentId}] Successfully processed and summarized document.`);
    }
    catch (error) {
        const errorMessage = error instanceof Error
            ? error.message
            : "An unknown error occurred during finalization.";
        console.error(`[${documentId}] Error finalizing processing:`, error);
        await docRef.update({
            status: "error",
            internalStatus: "result_handling_failed",
            errorMessage: errorMessage,
            updatedAt: firestore_1.Timestamp.now(),
        });
    }
});
//# sourceMappingURL=index.js.map