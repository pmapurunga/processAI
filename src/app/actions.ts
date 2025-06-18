
'use server';

import type { DocumentMetadata, ChatMessage, PersonaConfig } from '@/lib/types';
import { storage } from '@/lib/firebase'; // Certifique-se que storage está exportado de firebase.ts
import { ref, uploadBytes } from 'firebase/storage';
import { summarizeDocument } from '@/ai/flows/summarize-document';
import { queryDocument } from '@/ai/flows/query-document';
import { tuneAiPersona } from '@/ai/flows/tune-ai-persona';
import { extractTextWithDocumentAI } from '@/services/document-ai-service';

// Mock data store (simulando um banco de dados em memória)
let documents: DocumentMetadata[] = [
  {
    id: 'mock-doc-1',
    name: 'Sample Document 1.pdf',
    status: 'processed',
    uploadedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Yesterday
    updatedAt: new Date().toISOString(),
    summary: 'This is a mock summary for Sample Document 1, processed with real text extraction and summarization.',
    userId: 'mock-user-1',
    storagePath: 'pendingAnalysis/mock-user-1/mock-doc-1/Sample Document 1.pdf',
    gcsUri: 'gs://processai-v9qza.appspot.com/pendingAnalysis/mock-user-1/mock-doc-1/Sample Document 1.pdf',
    extractedText: 'This is some mock extracted text for Sample Document 1.'
  },
  {
    id: 'mock-doc-2',
    name: 'Another Example.pdf',
    status: 'processing',
    uploadedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    summary: undefined,
    userId: 'mock-user-1',
    storagePath: 'pendingAnalysis/mock-user-1/mock-doc-2/Another Example.pdf'
  },
];

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


export async function getDocuments(): Promise<DocumentMetadata[]> {
  console.log('getDocuments INVOKED');
  return JSON.parse(JSON.stringify(documents));
}

export async function getDocumentById(id: string): Promise<DocumentMetadata | undefined> {
  console.log(`getDocumentById INVOKED for id: ${id}`);
  const doc = documents.find(d => d.id === id);
  return doc ? JSON.parse(JSON.stringify(doc)) : undefined;
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
  const document = documents.find(d => d.id === data.documentId);
  if (!document || document.status !== 'processed' || !document.extractedText) {
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
      content: `Sorry, I encountered an error: ${errorMessage}`,
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
    return { success: false, message: `Error: ${errorMessage}` };
  }
}

export async function getDocumentSummary(documentId: string): Promise<string | null> {
  console.log(`getDocumentSummary INVOKED for documentId: ${documentId}`);
  const document = documents.find(d => d.id === documentId);
  if (document && document.summary) {
    return document.summary;
  }
  if (document && document.status === 'processed' && !document.summary && document.extractedText) {
    console.warn(`Document ${documentId} is processed but has no summary. Attempting to generate from extracted text.`);
    try {
      const summaryResult = await summarizeDocument({ documentText: document.extractedText });
      document.summary = summaryResult.summary;
      document.updatedAt = new Date().toISOString();
      return document.summary;
    } catch (e: any) {
      console.error("getDocumentSummary Genkit/AI Error on re-summarization:", e);
      return "Error re-generating summary.";
    }
  }
  if (document && (document.status === 'processing' || document.status === 'extracting_text' || document.status === 'summarizing' || document.status === 'uploading')) {
    return "Summary is being generated. Please wait.";
  }
  return null;
}

export async function processPdfUploadLogic(formData: FormData): Promise<{ success: boolean; message: string; documentId?: string; document?: DocumentMetadata; }> {
  console.log("[processPdfUploadLogic] INVOKED");

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
  // const userId = "mock-user-id"; // Temporarily hardcoded for rule matching.
  // For production, this should come from auth, and rules should accommodate server-side uploads.
  const userId = "mock-user-id"; 
  
  const newDocument: DocumentMetadata = {
    id: newDocumentId,
    name: file.name,
    status: 'uploading', 
    uploadedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    userId: userId,
  };
  documents.push(newDocument); 
  
  const updateDocStatus = (status: DocumentMetadata['status'], errorMessage?: string, gcsUri?: string, extractedText?: string, summary?: string) => {
    const docIndex = documents.findIndex(d => d.id === newDocumentId);
    if (docIndex > -1) {
      documents[docIndex].status = status;
      documents[docIndex].updatedAt = new Date().toISOString();
      if (gcsUri) documents[docIndex].gcsUri = gcsUri;
      if (extractedText) documents[docIndex].extractedText = extractedText;
      if (summary) documents[docIndex].summary = summary;
      if (errorMessage) {
        documents[docIndex].errorMessage = errorMessage;
        // Ensure summary reflects error if process fails before summarization
        if (status === 'error' && !documents[docIndex].summary) {
            documents[docIndex].summary = `Error: ${errorMessage}`;
        }
      }
    }
  };

  try {
    const storagePath = `pendingAnalysis/${userId}/${newDocumentId}/${file.name}`;
    const fileStorageRef = ref(storage, storagePath);

    console.log(`[processPdfUploadLogic] Attempting to upload ${file.name} to Firebase Storage: ${storagePath}`);
    await uploadBytes(fileStorageRef, file);
    newDocument.storagePath = fileStorageRef.fullPath; // Store the full path
    
    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (!bucketName) { 
        console.error('[processPdfUploadLogic] Firebase Storage bucket name (NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) is not configured in .env.');
        updateDocStatus('error', 'Firebase Storage bucket name not configured.');
        return { success: false, message: 'Configuration error: Storage bucket name not configured.', documentId: newDocumentId };
    }
    const gcsUri = `gs://${bucketName}/${storagePath}`;
    console.log(`[processPdfUploadLogic] File ${file.name} uploaded to ${storagePath}. GCS URI: ${gcsUri}.`);
    updateDocStatus('processing', undefined, gcsUri); // Status to 'processing' after successful upload

    // --- TEMPORARILY COMMENTED OUT DOCUMENT AI AND SUMMARIZATION FOR DEBUGGING UPLOAD ---
    // updateDocStatus('extracting_text', undefined, gcsUri);
    // console.log(`[processPdfUploadLogic] Calling Document AI to extract text from ${gcsUri}`);
    // const extractedText = await extractTextWithDocumentAI(gcsUri, file.type);
    // console.log(`[processPdfUploadLogic] Text extracted for ${newDocumentId}. Length: ${extractedText?.length || 0}.`);

    // let summary = "Summary pending further processing.";
    // if (!extractedText || extractedText.trim() === "") {
    //     console.warn(`[processPdfUploadLogic] Extracted text is empty for ${newDocumentId}. Document might be image-based or empty.`);
    //     summary = "No text content could be extracted from the document to summarize. The document might be image-based or empty.";
    //     updateDocStatus('processed', undefined, gcsUri, extractedText, summary);
    // } else {
    //     updateDocStatus('summarizing', undefined, gcsUri, extractedText);
    //     console.log(`[processPdfUploadLogic] Calling Genkit to summarize document ${newDocumentId}`);
    //     const summaryResult = await summarizeDocument({ documentText: extractedText });
    //     summary = summaryResult.summary;
    //     updateDocStatus('processed', undefined, gcsUri, extractedText, summary);
    // }
    // console.log(`[processPdfUploadLogic] Document ${newDocumentId} processed (upload successful, further processing skipped for debug).`);
    // return {
    //   success: true,
    //   message: `File '${file.name}' uploaded successfully. Further processing (Document AI, Summarization) temporarily skipped for debugging.`,
    //   documentId: newDocumentId,
    //   document: JSON.parse(JSON.stringify(newDocument))
    // };
    // --- END OF TEMPORARILY COMMENTED OUT SECTION ---

    // For now, just mark as processed after upload
    updateDocStatus('processed', undefined, gcsUri, 'Text extraction and summarization skipped for upload debugging.', 'Summary skipped for upload debugging.');
    console.log(`[processPdfUploadLogic] File '${file.name}' uploaded to Storage. Marking as 'processed' for now (skipping AI steps).`);

    return {
      success: true,
      message: `File '${file.name}' uploaded successfully. Text extraction and summarization steps were temporarily skipped for debugging the upload.`,
      documentId: newDocumentId,
      document: JSON.parse(JSON.stringify(newDocument))
    };

  } catch (error: any) {
    console.error(`[processPdfUploadLogic] Error during processing for ${file.name}:`, error);
    let detailedMessage = 'An unknown error occurred during processing.';

    if (error.code && typeof error.code === 'string' && error.code.startsWith('storage/')) {
      detailedMessage = `Firebase Storage Error (${error.code}): ${error.message || 'No specific message.'}`;
      if (error.serverResponse) {
        console.error('[processPdfUploadLogic] Firebase Server Response:', error.serverResponse);
        detailedMessage += ` Server Response: ${JSON.stringify(error.serverResponse)}`;
      }
    } else if (error instanceof Error) {
      detailedMessage = error.message;
    } else {
      detailedMessage = String(error);
    }
    
    console.error(`[processPdfUploadLogic] Detailed error for frontend: ${detailedMessage}`);
    updateDocStatus('error', detailedMessage);
    return {
      success: false,
      message: `Processing failed for '${file.name}': ${detailedMessage}`,
      documentId: newDocumentId
    };
  }
}
    
