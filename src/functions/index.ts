
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { ObjectMetadata } from 'firebase-functions/v1/storage';

// Local, self-contained imports
import { extractTextWithDocumentAI } from './document-ai';

// Initialize the Firebase Admin SDK
try {
  admin.initializeApp();
} catch (e) {
  // SDK already initialized
}

// NOTE: We can't import the Genkit flow directly as it might pull in client-side code.
// For now, we are creating a placeholder for the summarization logic.
// In a real-world scenario, you would create a self-contained summarization service
// similar to how we handled the Document AI service.
async function summarizeDocument(documentText: string): Promise<{ summary: string }> {
    console.log("Summarization step is a placeholder in this isolated function.");
    if (!documentText) return { summary: "No text to summarize." };
    // Returning a simple truncated summary as a placeholder.
    const placeholderSummary = documentText.substring(0, 500) + '... (summary placeholder)';
    return Promise.resolve({ summary: placeholderSummary });
}


export const processDocumentOnUpload = functions.storage.object().onFinalize(async (object: ObjectMetadata) => {
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
  const db = getFirestore();
  const docRef = db.collection('documents').doc(documentId);

  console.log(`[${documentId}] Starting processing for file: ${filePath}`);

  try {
    const gcsUri = `gs://${bucketName}/${filePath}`;
    
    await docRef.update({ status: 'extracting_text', updatedAt: new Date().toISOString() });
    const extractedText = await extractTextWithDocumentAI(gcsUri, contentType);

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

  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    console.error(`[${documentId}] Error processing document:`, error);
    try {
        await docRef.update({
            status: 'error',
            errorMessage: errorMessage,
            updatedAt: new Date().toISOString(),
        });
    } catch(dbError) {
        console.error(`[${documentId}] CRITICAL: Failed to write error status to Firestore.`, dbError);
    }
  }

  return null;
});
