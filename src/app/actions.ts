
'use server';

import type { DocumentMetadata, ChatMessage, PersonaConfig } from '@/lib/types';
import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
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
    storagePath: 'mock-path/Sample Document 1.pdf',
    gcsUri: 'gs://mock-bucket/mock-path/Sample Document 1.pdf',
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
    storagePath: 'mock-path/Another Example.pdf'
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
  console.log('[SERVER ACTION DEBUG] getDocuments INVOKED (MOCK)');
  return JSON.parse(JSON.stringify(documents));
}

export async function getDocumentById(id: string): Promise<DocumentMetadata | undefined> {
  console.log(`[SERVER ACTION DEBUG] getDocumentById INVOKED for id: ${id} (MOCK)`);
  const doc = documents.find(d => d.id === id);
  return doc ? JSON.parse(JSON.stringify(doc)) : undefined;
}

export async function getChatMessages(documentId: string): Promise<ChatMessage[]> {
  console.log(`[SERVER ACTION DEBUG] getChatMessages INVOKED for documentId: ${documentId} (MOCK)`);
  const messages = chatMessages.filter(msg => msg.documentId === documentId);
  return JSON.parse(JSON.stringify(messages));
}

export async function sendMessage(data: { documentId: string; message: string }): Promise<{
  success: boolean;
  userMessage?: ChatMessage;
  aiMessage?: ChatMessage;
  error?: string;
}> {
  console.log(`sendMessage called with id: ${data.documentId}`);
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

  // For RAG, you'd split document.extractedText into chunks and find relevant ones.
  // For now, we'll pass a portion or all of it as context for queryDocument.
  // This is a simplified RAG placeholder.
  const maxContextLength = 3000; // Arbitrary limit
  const documentChunks = [document.extractedText.substring(0, maxContextLength)];

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
  } catch (e) {
    console.error("[SERVER ACTION DEBUG] sendMessage Genkit/AI Error:", e);
    const errorMessage = e instanceof Error ? e.message : 'AI failed to respond.';
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
  console.log('[SERVER ACTION DEBUG] getAiPersona INVOKED (MOCK)');
  return JSON.parse(JSON.stringify(personaConfig));
}

export async function updateAiPersonaConfig(description: string): Promise<{
  success: boolean;
  message: string;
  persona?: PersonaConfig;
}> {
  console.log('[SERVER ACTION DEBUG] updateAiPersonaConfig INVOKED');
  try {
    const tunedResult = await tuneAiPersona({ personaDescription: description });
    personaConfig.description = tunedResult.updatedPersonaDescription;
    personaConfig.updatedAt = new Date().toISOString();
    return { success: true, message: 'AI Persona updated successfully.', persona: JSON.parse(JSON.stringify(personaConfig)) };
  } catch (e) {
    console.error("[SERVER ACTION DEBUG] updateAiPersonaConfig Genkit/AI Error:", e);
    const errorMessage = e instanceof Error ? e.message : 'Failed to tune persona.';
    return { success: false, message: `Error: ${errorMessage}` };
  }
}

export async function getDocumentSummary(documentId: string): Promise<string | null> {
  console.log(`[SERVER ACTION DEBUG] getDocumentSummary INVOKED for documentId: ${documentId}`);
  const document = documents.find(d => d.id === documentId);
  if (document && document.summary) {
    return document.summary;
  }
  if (document && document.status === 'processed' && !document.summary && document.extractedText) {
    console.warn(`[SERVER ACTION DEBUG] Document ${documentId} is processed but has no summary. Attempting to generate from extracted text.`);
    try {
      const summaryResult = await summarizeDocument({ documentText: document.extractedText });
      document.summary = summaryResult.summary;
      document.updatedAt = new Date().toISOString();
      return document.summary;
    } catch (e) {
      console.error("[SERVER ACTION DEBUG] getDocumentSummary Genkit/AI Error on re-summarization:", e);
      return "Error re-generating summary.";
    }
  }
  if (document && (document.status === 'processing' || document.status === 'extracting_text' || document.status === 'summarizing')) {
    return "Summary is being generated. Please wait.";
  }
  return null;
}

export async function processPdfUploadLogic(formData: FormData): Promise<{ success: boolean; message: string; documentId?: string; document?: DocumentMetadata; }> {
  console.log("[PROCESS PDF LOGIC] processPdfUploadLogic INVOKED");

  const fileEntry = formData.get('pdfFile');

  if (!fileEntry || !(fileEntry instanceof File)) {
    console.log("[PROCESS PDF LOGIC] No file found in FormData or not a File instance.");
    return { success: false, message: "No file found in form data." };
  }

  const file = fileEntry as File;
  console.log(`[PROCESS PDF LOGIC] File Name: ${file.name}, File Size: ${file.size}, File Type: ${file.type}`);

  if (!file.name.toLowerCase().endsWith('.pdf') || file.type !== 'application/pdf') {
    console.log("[PROCESS PDF LOGIC] Invalid file type, not a PDF.");
    return { success: false, message: "Invalid file type. Only PDF is allowed." };
  }
  
  const newDocumentId = `doc-${Date.now()}`;
  const userId = "mock-user-id"; // For a real app, get actual userId
  const storagePath = `uploads/${userId}/${newDocumentId}-${file.name}`;
  const fileStorageRef = ref(storage, storagePath);

  const newDocument: DocumentMetadata = {
    id: newDocumentId,
    name: file.name,
    status: 'uploading', 
    uploadedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    userId: userId,
    storagePath: undefined,
    gcsUri: undefined,
    summary: undefined,
    extractedText: undefined,
  };
  documents.push(newDocument); 

  try {
    console.log(`[PROCESS PDF LOGIC] Attempting to upload ${file.name} to Firebase Storage: ${storagePath}`);
    await uploadBytes(fileStorageRef, file);
    newDocument.storagePath = fileStorageRef.fullPath;
    // Construct GCS URI (ensure your bucket name is correct, often it's <project-id>.appspot.com)
    // You might need to fetch this from firebaseConfig.storageBucket if it's not fixed
    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.appspot.com`;
    newDocument.gcsUri = `gs://${bucketName}/${newDocument.storagePath}`;
    newDocument.status = 'extracting_text';
    newDocument.updatedAt = new Date().toISOString();
    console.log(`[PROCESS PDF LOGIC] File ${file.name} uploaded to ${newDocument.storagePath}. GCS URI: ${newDocument.gcsUri}. Status: extracting_text.`);

    // Extract text using Document AI
    if (!newDocument.gcsUri) { // Should not happen if uploadBytes was successful
        throw new Error("GCS URI is not available after upload.");
    }
    console.log(`[PROCESS PDF LOGIC] Calling Document AI to extract text from ${newDocument.gcsUri}`);
    const extractedText = await extractTextWithDocumentAI(newDocument.gcsUri, file.type);
    newDocument.extractedText = extractedText;
    newDocument.status = 'summarizing';
    newDocument.updatedAt = new Date().toISOString();
    console.log(`[PROCESS PDF LOGIC] Text extracted for ${newDocumentId}. Length: ${extractedText.length}. Status: summarizing.`);

    // Summarize the extracted text
    console.log(`[PROCESS PDF LOGIC] Calling Genkit to summarize document ${newDocumentId}`);
    if (!newDocument.extractedText || newDocument.extractedText.trim() === "") {
        console.warn(`[PROCESS PDF LOGIC] Extracted text is empty for ${newDocumentId}. Skipping summarization.`);
        newDocument.summary = "No text content found in the document to summarize.";
    } else {
        const summaryResult = await summarizeDocument({ documentText: newDocument.extractedText });
        newDocument.summary = summaryResult.summary;
    }
    newDocument.status = 'processed';
    newDocument.updatedAt = new Date().toISOString();
    console.log(`[PROCESS PDF LOGIC] Document ${newDocumentId} processed (text extracted and summarized).`);
    
    return {
      success: true,
      message: `File '${file.name}' processed successfully. Text extracted and summarized.`,
      documentId: newDocumentId,
      document: JSON.parse(JSON.stringify(newDocument))
    };

  } catch (error) {
    console.error(`[PROCESS PDF LOGIC] Error during processing for ${file.name}:`, error);
    const docIndex = documents.findIndex(d => d.id === newDocumentId);
    if (docIndex > -1) {
        documents[docIndex].status = 'error';
        documents[docIndex].updatedAt = new Date().toISOString();
        // Optionally save the error message to the document metadata
        // documents[docIndex].errorMessage = error instanceof Error ? error.message : String(error);
    }
    return {
      success: false,
      message: `Processing failed for '${file.name}': ${error instanceof Error ? error.message : 'Unknown processing error'}`,
      documentId: newDocumentId,