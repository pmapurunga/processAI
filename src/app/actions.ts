
'use server';

import type { DocumentMetadata, ChatMessage, PersonaConfig } from '@/lib/types';
import { storage, firestore } from '@/lib/firebase'; // Import firestore
import { ref, uploadBytes } from 'firebase/storage';
import { collection, doc, setDoc, getDoc, getDocs, query } from 'firebase/firestore'; // Import Firestore functions

// Import AI flow functions
import { summarizeDocument } from '@/ai/flows/summarize-document';
import { queryDocument } from '@/ai/flows/query-document';
import { tuneAiPersona } from '@/ai/flows/tune-ai-persona';
import { extractTextWithDocumentAI } from '@/services/document-ai-service';

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
  updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // Two days ago
};

// Get a reference to the 'documents' collection
const documentsCollection = collection(firestore, 'documents');
const BUCKET_NAME = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

export async function getDocuments(): Promise<DocumentMetadata[]> {
  console.log('getDocuments INVOKED');
  try {
    // Fetch all documents from Firestore (consider adding user filtering later)
    const snapshot = await getDocs(query(documentsCollection));
    const documents: DocumentMetadata[] = [];
    snapshot.forEach(doc => {
      // Cast data to DocumentMetadata, assuming Firestore data matches the type
      // Need to ensure Firestore document IDs are included
      documents.push({ id: doc.id, ...doc.data() } as DocumentMetadata);
    });
    return documents;
  } catch (error) {
    console.error('Error fetching documents from Firestore:', error);
    return []; // Return empty array on error
  }
}

export async function getDocumentById(id: string): Promise<DocumentMetadata | undefined> {
  console.log(`getDocumentById INVOKED for id: ${id}`);
  try {
    const docRef = doc(documentsCollection, id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      // Cast data to DocumentMetadata, assuming Firestore data matches the type
      // Need to ensure Firestore document ID is included
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

// NOTE: Chat messages are still in memory. Consider moving these to Firestore as well.
// Keeping this in memory for now as the focus is on document persistence
export async function getChatMessages(documentId: string): Promise<ChatMessage[]> {
    console.log(`getChatMessages INVOKED for documentId: ${documentId}`);
    const messages = chatMessages.filter(msg => msg.documentId === documentId);
    return JSON.parse(JSON.stringify(messages)); // Keep JSON.parse(JSON.stringify()) for serialization
}

export async function sendMessage(data: { documentId: string; message: string }): Promise<{
  success: boolean;
  userMessage?: ChatMessage;
  aiMessage?: ChatMessage;
  error?: string;
}> {
  console.log(`sendMessage INVOKED for documentId: ${data.documentId}`);
  // Use the updated getDocumentById that reads from Firestore
  const document = await getDocumentById(data.documentId);

  // Now relying on `extractedText` being saved to Firestore.
  if (!document || document.status !== 'processed' || !document.extractedText) {
    // Check status again after fetching from DB to ensure it's processed
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
  // NOTE: Chat messages are still in memory. Consider moving these to Firestore as well.
  chatMessages.push(userMessage);

  // --- RE-ENABLED AI CALLS ---
  const maxContextLength = 30000; 
  let documentChunks = [];
  if (document.extractedText) {
    for (let i = 0; i < document.extractedText.length; i += maxContextLength) {
      documentChunks.push(document.extractedText.substring(i, i + maxContextLength));
    }
  } else {
     // This case should ideally not happen if status is 'processed' but good for safety
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
    chatMessages.push(aiMessage); // Still in memory
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
    chatMessages.push(aiMessage); // Still in memory
    return { success: true, userMessage: JSON.parse(JSON.stringify(userMessage)), aiMessage: JSON.parse(JSON.stringify(aiMessage)), error: `AI error: ${errorMessage}` };
  }
  // --- END OF RE-ENABLED AI CALLS ---

}

// NOTE: Persona config is still in memory. Consider moving this to Firestore.
// Keeping this in memory for now as the focus is on document persistence
export async function getAiPersona(): Promise<PersonaConfig> {
  console.log('getAiPersona INVOKED');
  return JSON.parse(JSON.stringify(personaConfig));
}

// NOTE: Persona config is still in memory. Consider moving this to Firestore.
// Keeping this in memory for now as the focus is on document persistence
export async function updateAiPersonaConfig(description: string): Promise<{
  success: boolean;
  message: string;
  persona?: PersonaConfig;
}> {
  console.log('updateAiPersonaConfig INVOKED');
   // Keeping this in memory for now as the focus is on document persistence
  try {
    // --- RE-ENABLED AI CALL ---
    const tunedResult = await tuneAiPersona({ personaDescription: description });
    personaConfig.description = tunedResult.updatedPersonaDescription;
    // --- END OF RE-ENABLED AI CALL ---

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
  // Use the updated getDocumentById that reads from Firestore
  const document = await getDocumentById(documentId);

  // Now relying on `summary` and `extractedText` being saved to Firestore.
  if (document && document.summary) {
    return document.summary;
  }

  // If summary is missing but document is processed and has extracted text, attempt to generate
  if (document && document.status === 'processed' && !document.summary && document.extractedText) {
     // --- RE-ENABLED AI CALL ---
    console.warn(`Document ${documentId} is processed but has no summary. Attempting to generate from extracted text.`);
    try {
      const summaryResult = await summarizeDocument({ documentText: document.extractedText });
      const newSummary = summaryResult.summary || "Could not generate summary.";
      // NOTE: Update the document in Firestore with the new summary
      const docRef = doc(documentsCollection, documentId);
      await setDoc(docRef, { summary: newSummary, updatedAt: new Date().toISOString() }, { merge: true });

      // Although we updated Firestore, return the new summary directly for immediate use
      return newSummary;
    } catch (e: any) {
      console.error("getDocumentSummary Genkit/AI Error on re-summarization:", e);
       const errorMessage = e instanceof Error ? e.message : String(e);
       // Attempt to save error status/message to document in Firestore
       const docRef = doc(documentsCollection, documentId);
       await setDoc(docRef, { status: 'error', updatedAt: new Date().toISOString(), errorMessage: `Summarization failed: ${errorMessage}` }, { merge: true });
      return `Error generating summary: ${errorMessage}`; // Return error message to frontend
    }
    // --- END OF RE-ENABLED AI CALL ---
  }

  if (document && (document.status === 'processing' || document.status === 'extracting_text' || document.status === 'summarizing' || document.status === 'uploading')) {
    return "Summary is being generated. Please wait.";
  }
  
  // If document is not found, not processed, or has no extracted text and no existing summary
  return document?.errorMessage || "Summary not available.";
}

export async function processPdfUploadLogic(formData: FormData): Promise<{ success: boolean; message: string; documentId?: string; document?: DocumentMetadata; }> {
  console.log("[processPdfUploadLogic] INVOKED");

  if (!BUCKET_NAME) {
    console.error("[processPdfUploadLogic] Firebase Storage Bucket Name (NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) is not configured in .env.");
    return { success: false, message: "Server configuration error: Storage bucket name missing." };
  }

  const fileEntry = formData.get('pdfFile');

  if (!fileEntry || !(fileEntry instanceof File)) {
    console.log("[processPdfUploadLogic] No file found in FormData or not a File instance.");
    return { success: false, message: "No file found in form data." };
  }

  const file = fileEntry as File;
  console.log(`[processPdfUploadLogic] File Name: ${file.name}, File Size: ${file.size}, File Type: ${file.type}`);

  if (!file.name.toLowerCase().endsWith('.pdf') || file.type !== 'application/pdf') {
    console.log("[processPdfUploadLogic] Invalid file type, not a PDF.");
    return { success: false, message: "Invalid file type. Only PDF is allowed." };
  }

  const newDocumentId = `doc-${Date.now()}`;
  const userId = "mock-user-id"; // Temporarily hardcoded, integrate with auth later

  // Initial document data to save to Firestore
  const initialDocumentData: Omit<DocumentMetadata, 'extractedText' | 'summary' | 'errorMessage' | 'storagePath'> = {
    id: newDocumentId,
    name: file.name,
    status: 'uploading', // Initial status
    uploadedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    userId: userId,
  };
  const docRef = doc(documentsCollection, newDocumentId); // Define docRef early for use in catch

   try {
    // Add the initial document data to Firestore *before* the upload
    await setDoc(docRef, initialDocumentData);
    console.log(`[processPdfUploadLogic] Initial document entry created in Firestore with id: ${newDocumentId}`);

    const storagePath = `pendingAnalysis/${userId}/${newDocumentId}/${file.name}`;
    const fileStorageRef = ref(storage, storagePath);

    console.log(`[processPdfUploadLogic] Attempting to upload ${file.name} to Firebase Storage: ${storagePath}`);
    await uploadBytes(fileStorageRef, file);
    const gcsPathForDocAI = `gs://${BUCKET_NAME}/${storagePath}`;
    console.log(`[processPdfUploadLogic] File ${file.name} uploaded to ${storagePath}. GCS URI for Document AI: ${gcsPathForDocAI}.`);
    
    // Update status to indicate processing started
    await setDoc(docRef, { status: 'processing', updatedAt: new Date().toISOString(), storagePath: storagePath }, { merge: true });
    console.log(`[processPdfUploadLogic] Document status updated to 'processing' in Firestore.`);

    // --- DOCUMENT AI AND SUMMARIZATION ---
    await setDoc(docRef, { status: 'extracting_text', updatedAt: new Date().toISOString() }, { merge: true });
    console.log(`[processPdfUploadLogic] Calling Document AI to extract text from ${gcsPathForDocAI}`);
    
    const extractedText = await extractTextWithDocumentAI(gcsPathForDocAI, file.type);
    console.log(`[processPdfUploadLogic] Text extracted for ${newDocumentId}. Length: ${extractedText?.length || 0}.`);

    let summary = "Summary pending.";
    if (!extractedText || extractedText.trim() === "") {
        console.warn(`[processPdfUploadLogic] Extracted text is empty for ${newDocumentId}. Document might be image-based or empty.`);
        summary = "No text content could be extracted from the document to summarize. The document might be image-based or empty.";
        await setDoc(docRef, { status: 'processed', updatedAt: new Date().toISOString(), extractedText: extractedText || '', summary: summary }, { merge: true });

    } else {
        await setDoc(docRef, { status: 'summarizing', updatedAt: new Date().toISOString(), extractedText: extractedText }, { merge: true });
        console.log(`[processPdfUploadLogic] Calling Genkit to summarize document ${newDocumentId}`);
        const summaryResult = await summarizeDocument({ documentText: extractedText });
        summary = summaryResult.summary || "Could not generate summary.";
        await setDoc(docRef, { status: 'processed', updatedAt: new Date().toISOString(), summary: summary }, { merge: true });
    }
    console.log(`[processPdfUploadLogic] Document ${newDocumentId} fully processed.`);
    // --- END OF DOCUMENT AI AND SUMMARIZATION ---

    // Fetch the final updated document data from Firestore to return in the response
    const updatedDocSnap = await getDoc(docRef);
    const updatedDocument = updatedDocSnap.exists() ? ({ id: updatedDocSnap.id, ...updatedDocSnap.data() } as DocumentMetadata) : undefined;

    return {
      success: true,
      message: `File '${file.name}' uploaded and processed successfully. Metadata, extracted text, and summary saved to Firestore.`,
      documentId: newDocumentId,
      document: updatedDocument // Return the final document data from Firestore
    };

  } catch (error: any) {
    console.error(`[processPdfUploadLogic] Error during processing for ${file.name}:`, error);
    let detailedMessage = 'An unknown error occurred during processing.';
    let currentDocumentStatus: DocumentMetadata['status'] = 'error'; 

     try {
         const docSnap = await getDoc(docRef);
          if(docSnap.exists()){
              const existingData = docSnap.data() as DocumentMetadata;
               currentDocumentStatus = existingData.status || 'error'; 
          }
     } catch(dbReadError) {
         console.error("[processPdfUploadLogic] Error reading document status during error handling:", dbReadError);
     }

    if (error.code && typeof error.code === 'string' && error.code.startsWith('storage/')) {
      detailedMessage = `Firebase Storage Error (${error.code}): ${error.message || 'No specific message.'}`;
       if(currentDocumentStatus === 'uploading') currentDocumentStatus = 'error';
    } else if (error.code && typeof error.code === 'string') { 
       detailedMessage = `${error.code}: ${error.message || 'No specific message.'}`;
       currentDocumentStatus = 'error'; 
    } else if (error instanceof Error) {
      detailedMessage = error.message;
       currentDocumentStatus = 'error'; 
    } else {
      detailedMessage = String(error);
       currentDocumentStatus = 'error'; 
    }
    console.error(`[processPdfUploadLogic] Detailed error for frontend: ${detailedMessage}`);

    // Try to update the document status in Firestore to 'error'
    if (newDocumentId) { // newDocumentId should always be defined if we reached here after initial Firestore set
         try {
             await setDoc(docRef, { status: currentDocumentStatus, updatedAt: new Date().toISOString(), errorMessage: detailedMessage }, { merge: true });
             console.log(`[processPdfUploadLogic] Document entry in Firestore updated to status '${currentDocumentStatus}' for id: ${newDocumentId}`);
         } catch (dbError) {
             console.error(`[processPdfUploadLogic] Failed to update document status to error in Firestore for ${newDocumentId}:`, dbError);
         }
    }

    return {
      success: false,
      message: `Processing failed for '${file.name}': ${detailedMessage}`,
      documentId: newDocumentId
    };
  }
}
