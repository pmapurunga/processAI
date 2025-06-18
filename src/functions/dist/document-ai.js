"use strict";
// This is a self-contained service file for the Cloud Function.
// It does not use 'use server' or any Next.js-specific features.
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractTextWithDocumentAI = extractTextWithDocumentAI;
const documentai_1 = require("@google-cloud/documentai");
// These should be set as environment variables on the Cloud Function
const projectId = process.env.GCP_PROJECT_ID;
const location = process.env.DOCUMENT_AI_LOCATION;
const processorId = process.env.DOCUMENT_AI_PROCESSOR_ID;
const client = new documentai_1.DocumentProcessorServiceClient();
async function extractTextWithDocumentAI(gcsDocumentUri, mimeType) {
    if (!projectId || !location || !processorId) {
        const errorMsg = 'Missing environment variables for Document AI Service in the Cloud Function environment.';
        console.error(errorMsg);
        throw new Error(errorMsg);
    }
    const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;
    const request = {
        name,
        gcsDocument: {
            gcsUri: gcsDocumentUri,
            mimeType: mimeType,
        },
        skipHumanReview: true,
    };
    try {
        console.log(`[Function] Calling Document AI for ${gcsDocumentUri}`);
        const [result] = await client.processDocument(request);
        const { document } = result;
        if (!document || !document.text) {
            console.warn('[Function] Document AI processed but no text was extracted.');
            return '';
        }
        console.log(`[Function] Text extracted successfully. Length: ${document.text.length}`);
        return document.text;
    }
    catch (error) {
        console.error('[Function] Error processing document with Document AI:', error);
        const errorMessage = error.details || (error instanceof Error ? error.message : String(error));
        throw new Error(`Failed to process document with Document AI: ${errorMessage}`);
    }
}
//# sourceMappingURL=document-ai.js.map