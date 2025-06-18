
'use server';

import { auth as adminAuth } from 'firebase-admin';
import type { DocumentMetadata, ChatMessage, PersonaConfig } from '@/lib/types';
import { storage, firestore } from '@/lib/firebase';
import { ref, uploadBytes, getBytes } from 'firebase/storage'; // Added getBytes
import { collection, doc, setDoc, getDoc, getDocs, query, where } from 'firebase/firestore'; // Added where

// Import AI flow functions
import { summarizeDocument } from '@/ai/flows/summarize-document';
import { queryDocument } from '@/ai/flows/query-document';
import { tuneAiPersona } from '@/ai/flows/tune-ai-persona';
// import { extractTextWithDocumentAI } from '@/services/document-ai-service'; // Reverted this to direct content
import { DocumentProcessorServiceClient } from '@google-cloud/documentai'; // Keep this for direct content approach

// Keep mock data for items not yet migrated to Firestore (Chat Messages, Persona Config)
let chatMessages: ChatMessage[] = [
    {
        id: 'msg1',
        documentId: 'mock-doc-1',
        role: 'assistant',
        content: 'Hello! How can I help you with Sample Document 1?',
        timestamp: Date.now() - 10000,
    }
];

let personaConfig: PersonaConfig = {
  description: 'You are a helpful AI assistant. Be friendly and concise.',
  updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
};

const documentsCollection = collection(firestore, 'documents');
const BUCKET_NAME = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

// This function now requires a user ID to fetch user-specific documents
export async function getDocuments(userId: string): Promise<DocumentMetadata[]> {
  if (!userId) {
    console.error('getDocuments called without a userId.');
    return [];
  }
  console.log(`getDocuments INVOKED for userId: ${userId}`);
  try {
    const q = query(documentsCollection, where("userId", "==", userId));
    const snapshot = await getDocs(q);
    const documents: DocumentMetadata[] = [];
    snapshot.forEach(docSnap => { // Renamed doc to docSnap to avoid conflict
      documents.push({ id: docSnap.id, ...docSnap.data() } as DocumentMetadata);
    });
    return documents;
  } catch (error) {
    console.error('Error fetching documents from Firestore:', error);
    return [];
  }
}


export async function getDocumentById(id: string): Promise<DocumentMetadata | undefined> {
  console.log(`getDocumentById INVOKED for id: ${id}`);
  try {
    const docRef = doc(documentsCollection, id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as DocumentMetadata;
    } else {
      console.log(`Document with id ${id} not found in Firestore.`);
      return undefined;
    }
  } catch (error) {
    console.error(`Error fetching document ${id} from Firestore:`, error);
    return undefined;
  }
}

export async function getChatMessages(documentId: string): Promise<ChatMessage[]> {
    console.log(`getChatMessages INVOKED for documentId: ${documentId}`);
    const messages = chatMessages.filter(msg => msg.documentId === documentId);
    return JSON.parse(JSON.stringify(messages));
}

export async function sendMessage(data: { documentId: string; message: string }): Promise<{
  success: boolean;
  userMessage?: ChatMessage;
  aiMessage?: ChatMessage;
  error?: string;
}> {
  console.log(`sendMessage INVOKED for documentId: ${data.documentId}`);
  const document = await getDocumentById(data.documentId);

  if (!document || document.status !== 'processed' || !document.extractedText) {
    if (document && document.status !== 'processed'){
         return { success: false, error: `Document is not yet processed. Current status: ${document.status}.` };
    }
    return { success: false, error: 'Document not found, not processed, or text not extracted.' };
  }

  const userMessage: ChatMessage = {
    id: `user-${Date.now()}`,
    documentId: data.documentId,
    role: 'user',
    content: data.message,
    timestamp: Date.now(),
  };
  chatMessages.push(userMessage);

  const maxContextLength = 30000;
  let documentChunks = [];
  if (document.extractedText) {
    for (let i = 0; i < document.extractedText.length; i += maxContextLength) {
      documentChunks.push(document.extractedText.substring(i, i + maxContextLength));
    }
  } else {
    documentChunks.push("No text extracted from document.");
  }

  try {
    const aiResponse = await queryDocument({ query: data.message, documentChunks });

    const aiMessage: ChatMessage = {
      id: `ai-${Date.now()}`,
      documentId: data.documentId,
      role: 'assistant',
      content: aiResponse.answer || "I'm having trouble responding right now.",
      timestamp: Date.now() + 1,
    };
    chatMessages.push(aiMessage);
    return { success: true, userMessage: JSON.parse(JSON.stringify(userMessage)), aiMessage: JSON.parse(JSON.stringify(aiMessage)) };
  } catch (e: any) {
    console.error("sendMessage Genkit/AI Error:", e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    const aiMessage: ChatMessage = {
      id: `ai-err-${Date.now()}`,
      documentId: data.documentId,
      role: 'assistant',
      content: `Sorry, I encountered an error while trying to get an AI response: ${errorMessage}`,
      timestamp: Date.now() + 1,
    };
    chatMessages.push(aiMessage);
    return { success: true, userMessage: JSON.parse(JSON.stringify(userMessage)), aiMessage: JSON.parse(JSON.stringify(aiMessage)), error: `AI error: ${errorMessage}` };
  }
}

export async function getAiPersona(): Promise<PersonaConfig> {
  console.log('getAiPersona INVOKED');
  return JSON.parse(JSON.stringify(personaConfig));
}

export async function updateAiPersonaConfig(description: string): Promise<{
  success: boolean;
  message: string;
  persona?: PersonaConfig;
}> {
  console.log('updateAiPersonaConfig INVOKED');
  try {
    const tunedResult = await tuneAiPersona({ personaDescription: description });
    personaConfig.description = tunedResult.updatedPersonaDescription;
    personaConfig.updatedAt = new Date().toISOString();
    return { success: true, message: 'AI Persona updated successfully.', persona: JSON.parse(JSON.stringify(personaConfig)) };
  } catch (e: any) {
    console.error("updateAiPersonaConfig Genkit/AI Error:", e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    return { success: false, message: `Error updating AI Persona: ${errorMessage}` };
  }
}

export async function getDocumentSummary(documentId: string): Promise<string | null> {
  console.log(`getDocumentSummary INVOKED for documentId: ${documentId}`);
  const document = await getDocumentById(documentId);

  if (document && document.summary && document.summary !== "Your document is in the queue and will be processed shortly." && document.summary !== "Summary is being generated. Please wait.") {
    return document.summary;
  }

  if (document && document.status === 'processed' && (!document.summary || document.summary === "Your document is in the queue and will be processed shortly." || document.summary === "Summary is being generated. Please wait.") && document.extractedText) {
    console.warn(`Document ${documentId} is processed but has no valid summary. Attempting to generate.`);
    try {
      const summaryResult = await summarizeDocument({ documentText: document.extractedText });
      const newSummary = summaryResult.summary || "Could not generate summary.";
      const docRef = doc(documentsCollection, documentId);
      await setDoc(docRef, { summary: newSummary, updatedAt: new Date().toISOString() }, { merge: true });
      return newSummary;
    } catch (e: any) {
      console.error("getDocumentSummary Genkit/AI Error on re-summarization:", e);
       const errorMessage = e instanceof Error ? e.message : String(e);
       const docRef = doc(documentsCollection, documentId);
       await setDoc(docRef, { status: 'error', errorMessage: `Summarization failed: ${errorMessage}` }, { merge: true });
      return `Error generating summary: ${errorMessage}`;
    }
  }

  if (document && (document.status === 'processing' || document.status === 'extracting_text' || document.status === 'summarizing' || document.status === 'uploading' || document.status === 'queued')) {
    return "Summary is being generated. Please wait.";
  }

  return document?.errorMessage || "Summary not available.";
}

// Reverted to GCS URI approach for Document AI
// This function matches the one from commit: f477553602bb4082821b122d06e5129c89a8769e
// (The one before attempt to send bytes directly)
async function callDocumentAI(gcsDocumentUri: string, mimeType: string): Promise<string> {
  console.log(`[callDocumentAI] Processing document: ${gcsDocumentUri}`);
  const projectId = process.env.GCP_PROJECT_ID;
  const location = process.env.DOCUMENT_AI_LOCATION;
  const processorId = process.env.DOCUMENT_AI_PROCESSOR_ID;

  if (!projectId || !location || !processorId) {
    const errorMsg = 'Missing GCP_PROJECT_ID, DOCUMENT_AI_LOCATION, or DOCUMENT_AI_PROCESSOR_ID environment variables for Document AI Service';
    console.error(`[callDocumentAI] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  const client = new DocumentProcessorServiceClient();
  const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;

  const request = {
    name,
    gcsDocument: {
      gcsUri: gcsDocumentUri,
      mimeType: mimeType,
    },
    skipHumanReview: true,
  };
  console.log('[callDocumentAI] Request to Document AI:', JSON.stringify(request, null, 2));

  try {
    const [result] = await client.processDocument(request);
    const { document } = result;

    if (!document || !document.text) {
      console.warn('[callDocumentAI] Document AI processed but no text was extracted.');
      return '';
    }
    console.log(`[callDocumentAI] Text extracted successfully. Length: ${document.text.length}`);
    return document.text;
  } catch (error: any) {
    console.error('[callDocumentAI] Error processing document with Document AI:', error);
    const errorMessage = error.details || (error instanceof Error ? error.message : String(error));
    throw new Error(`Failed to process document with Document AI: ${error.code} ${errorMessage}`);
  }
}


export async function processPdfUploadLogic(formData: FormData): Promise<{ success: boolean; message: string; documentId?: string; document?: DocumentMetadata; }> {
  console.log("[processPdfUploadLogic] INVOKED");

  const fileEntry = formData.get('pdfFile');
  const idToken = formData.get('idToken'); // Auth token from client

  if (!idToken || typeof idToken !== 'string') {
      return { success: false, message: "Authentication token is missing." };
  }

  let userId: string;
  try {
      // Verify the ID token to get the authenticated user's ID
      const decodedToken = await adminAuth().verifyIdToken(idToken);
      userId = decodedToken.uid;
      console.log(`[processPdfUploadLogic] Token verified for user ID: ${userId}`);
  } catch (error) {
      console.error("[processPdfUploadLogic] Invalid or expired ID token:", error);
      return { success: false, message: "Authentication failed. Please sign in again." };
  }

  if (!BUCKET_NAME) {
    const errorMsg = "Server configuration error: Firebase Storage Bucket Name is not configured.";
    console.error(`[processPdfUploadLogic] ${errorMsg}`);
    return { success: false, message: errorMsg };
  }

  if (!fileEntry || !(fileEntry instanceof File)) {
    return { success: false, message: "No file found in form data." };
  }

  const file = fileEntry as File;
  console.log(`[processPdfUploadLogic] File Name: ${file.name}, File Size: ${file.size}, File Type: ${file.type}`);

  if (!file.name.toLowerCase().endsWith('.pdf') || file.type !== 'application/pdf') {
    return { success: false, message: "Invalid file type. Only PDF is allowed." };
  }

  const newDocumentId = `doc-${Date.now()}`;
  // Corrected path structure to match existing rules (pendingAnalysis/{userId}/{processId}/{fileName})
  const storagePath = `pendingAnalysis/${userId}/${newDocumentId}/${file.name}`;
  const docRef = doc(documentsCollection, newDocumentId);

  try {
    // Initial Firestore document creation with 'uploading' status
    const initialDocData: DocumentMetadata = {
      id: newDocumentId,
      name: file.name,
      status: 'uploading', // Set initial status
      uploadedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userId: userId, // Store the authenticated userId
      storagePath: storagePath, // Store the intended GCS path
      summary: "File upload in progress...",
    };
    await setDoc(docRef, initialDocData);
    console.log(`[processPdfUploadLogic] Initial document entry created in Firestore with id: ${newDocumentId}`);

    // Upload to Firebase Storage
    console.log(`[processPdfUploadLogic] Attempting to upload ${file.name} to Firebase Storage: ${storagePath}`);
    const fileStorageRef = ref(storage, storagePath);
    await uploadBytes(fileStorageRef, file);

    const gcsUri = `gs://${BUCKET_NAME}/${storagePath}`;
    console.log(`[processPdfUploadLogic] File ${file.name} uploaded to ${storagePath}. Corrected GCS URI for Document AI: ${gcsUri}.`);

    await setDoc(docRef, { status: 'processing', updatedAt: new Date().toISOString() }, { merge: true });
    console.log(`[processPdfUploadLogic] Document status updated to 'processing' in Firestore.`);

    // Call Document AI with GCS URI
    console.log(`[processPdfUploadLogic] Calling Document AI to extract text from ${gcsUri}`);
    const extractedText = await callDocumentAI(gcsUri, file.type);

    if (!extractedText || extractedText.trim() === "") {
        console.warn(`[processPdfUploadLogic] No text extracted by Document AI for ${newDocumentId}.`);
        await setDoc(docRef, {
            status: 'processed', // Or 'error' if no text is considered an error
            summary: 'No text could be extracted from the document.',
            extractedText: '',
            updatedAt: new Date().toISOString(),
            errorMessage: 'No text extracted by Document AI.',
        }, { merge: true });
         return {
            success: true, // Or false, depending on how "no text" should be handled
            message: `File '${file.name}' processed, but no text was extracted.`,
            documentId: newDocumentId,
            document: await getDocumentById(newDocumentId)
        };
    }

    await setDoc(docRef, { status: 'summarizing', extractedText: extractedText, updatedAt: new Date().toISOString() }, { merge: true });
    console.log(`[processPdfUploadLogic] Text extracted, now summarizing document ${newDocumentId}.`);

    const summaryResult = await summarizeDocument({ documentText: extractedText });
    await setDoc(docRef, {
        status: 'processed',
        summary: summaryResult.summary,
        updatedAt: new Date().toISOString(),
        errorMessage: null, // Clear any previous error message
    }, { merge: true });
    console.log(`[processPdfUploadLogic] Document ${newDocumentId} successfully processed and summarized.`);

    const finalDocument = await getDocumentById(newDocumentId);
    return {
      success: true,
      message: `File '${file.name}' has been successfully processed.`,
      documentId: newDocumentId,
      document: finalDocument
    };

  } catch (error: any) {
    console.error(`[processPdfUploadLogic] Error during processing for ${file.name}:`, error);
    const detailedMessage = error instanceof Error ? error.message : String(error);
    console.error(`[processPdfUploadLogic] Detailed error for frontend: ${detailedMessage}`);
    try {
      await setDoc(docRef, { status: 'error', errorMessage: detailedMessage, updatedAt: new Date().toISOString() }, { merge: true });
      console.log(`[processPdfUploadLogic] Document entry in Firestore updated to status 'error' for id: ${newDocumentId}`);
    } catch (dbError) {
      console.error(`[processPdfUploadLogic] CRITICAL: Failed to write error status to Firestore for ${newDocumentId}. DB Error:`, dbError);
    }
    return {
      success: false,
      message: `Processing failed for '${file.name}': ${detailedMessage}`,
      documentId: newDocumentId // Return documentId even on failure
    };
  }
}
