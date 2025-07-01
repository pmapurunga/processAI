"use strict";
// This is a self-contained service file for the Cloud Function.
// It does not use 'use server' or any Next.js-specific features.
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
exports.startBatchDocumentProcessing = startBatchDocumentProcessing;
const documentai_1 = require("@google-cloud/documentai");
const functions = __importStar(require("firebase-functions"));
// These should be set as environment variables on the Cloud Function
const projectId = functions.config().gcp.project_id;
const location = functions.config().document_ai.location;
const processorId = functions.config().document_ai.processor_id;
const client = new documentai_1.DocumentProcessorServiceClient();
/**
 * Initiates a batch (asynchronous) processing job for a large document.
 *
 * @param gcsInputUri The GCS URI of the document to process.
 * @param gcsOutputUri The GCS URI where the output JSON should be stored.
 * @param mimeType The MIME type of the document.
 * @returns The promise of a long-running operation.
 */
async function startBatchDocumentProcessing(gcsInputUri, gcsOutputUri, mimeType) {
    if (!projectId || !location || !processorId) {
        const errorMsg = 'Missing environment variables for Document AI Service in the Cloud Function environment.';
        console.error(errorMsg);
        throw new Error(errorMsg);
    }
    const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;
    // Configure the batch process request
    const request = {
        name,
        inputDocuments: {
            gcsDocuments: {
                documents: [
                    {
                        gcsUri: gcsInputUri,
                        mimeType,
                    },
                ],
            },
        },
        documentOutputConfig: {
            // Corrected property name from gcsConfig to gcsOutputConfig
            gcsOutputConfig: {
                gcsUri: gcsOutputUri,
            },
        },
        skipHumanReview: true,
    };
    try {
        console.log('[Function] Starting batch processing job with request:', JSON.stringify(request, null, 2));
        const [operation] = await client.batchProcessDocuments(request);
        console.log(`[Function] Batch processing job created. Operation name: ${operation.name}`);
        return operation;
    }
    catch (error) {
        console.error('[Function] Error starting batch processing job:', error);
        const errorMessage = error.details || (error instanceof Error ? error.message : String(error));
        throw new Error(`Failed to start batch processing job: ${errorMessage}`);
    }
}
//# sourceMappingURL=document-ai.js.map