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
exports.processDocumentOnUpload = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
// Local, self-contained imports
const document_ai_1 = require("./document-ai");
// Initialize the Firebase Admin SDK
try {
    admin.initializeApp();
}
catch (e) {
    // SDK already initialized
}
// NOTE: We can't import the Genkit flow directly as it might pull in client-side code.
// For now, we are creating a placeholder for the summarization logic.
// In a real-world scenario, you would create a self-contained summarization service
// similar to how we handled the Document AI service.
async function summarizeDocument(documentText) {
    console.log("Summarization step is a placeholder in this isolated function.");
    if (!documentText)
        return { summary: "No text to summarize." };
    // Returning a simple truncated summary as a placeholder.
    const placeholderSummary = documentText.substring(0, 500) + '... (summary placeholder)';
    return Promise.resolve({ summary: placeholderSummary });
}
exports.processDocumentOnUpload = functions.storage.object().onFinalize(async (object) => {
    const filePath = object.name;
    const contentType = object.contentType;
    const bucketName = object.bucket;
    if (!filePath || !filePath.startsWith('uploads/') || !contentType || !contentType.includes('pdf')) {
        console.log(`File ${filePath} is not a PDF in the 'uploads/' folder. Skipping.`);
        return null;
    }
    const pathParts = filePath.split('/');
    if (pathParts.length < 4) {
        console.error(`Invalid path structure: ${filePath}. Cannot extract documentId.`);
        return null;
    }
    const documentId = pathParts[2];
    const db = (0, firestore_1.getFirestore)();
    const docRef = db.collection('documents').doc(documentId);
    console.log(`[${documentId}] Starting processing for file: ${filePath}`);
    try {
        const gcsUri = `gs://${bucketName}/${filePath}`;
        await docRef.update({ status: 'extracting_text', updatedAt: new Date().toISOString() });
        const extractedText = await (0, document_ai_1.extractTextWithDocumentAI)(gcsUri, contentType);
        if (!extractedText || extractedText.trim() === '') {
            await docRef.update({
                status: 'processed',
                summary: 'No text was extracted from the document.',
                updatedAt: new Date().toISOString()
            });
            return null;
        }
        await docRef.update({ status: 'summarizing', extractedText: extractedText, updatedAt: new Date().toISOString() });
        const summaryResult = await summarizeDocument(extractedText);
        await docRef.update({
            status: 'processed',
            summary: summaryResult.summary,
            updatedAt: new Date().toISOString(),
            errorMessage: null,
        });
        console.log(`[${documentId}] Successfully processed document.`);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        console.error(`[${documentId}] Error processing document:`, error);
        try {
            await docRef.update({
                status: 'error',
                errorMessage: errorMessage,
                updatedAt: new Date().toISOString(),
            });
        }
        catch (dbError) {
            console.error(`[${documentId}] CRITICAL: Failed to write error status to Firestore.`, dbError);
        }
    }
    return null;
});
//# sourceMappingURL=index.js.map