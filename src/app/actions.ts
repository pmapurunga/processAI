
'use server';

import type { DocumentMetadata, ChatMessage, PersonaConfig } from '@/lib/types';
import { storage } from '@/lib/firebase';
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
  console.log('[MOCK SERVER ACTION] getDocuments INVOKED');
  return JSON.parse(JSON.stringify(documents));
}

export async function getDocumentById(id: string): Promise<DocumentMetadata | undefined> {
  console.log(`[MOCK SERVER ACTION] getDocumentById INVOKED for id: ${id}`);
  const doc = documents.find(d => d.id === id);
  return doc ? JSON.parse(JSON.stringify(doc)) : undefined;
}

export async function getChatMessages(documentId: string): Promise<ChatMessage[]> {
  console.log(`[MOCK SERVER ACTION] getChatMessages INVOKED for documentId: ${documentId}`);
  const messages = chatMessages.filter(msg => msg.documentId === documentId);
  return JSON.parse(JSON.stringify(messages));
}

export async function sendMessage(data: { documentId: string; message: string }): Promise<{
  success: boolean;
  userMessage?: ChatMessage;
  aiMessage?: ChatMessage;
  error?: string;
}> {
  console.log(`SendMessage called for documentId: ${data.documentId}`);
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
  } catch (e) {
    console.error("sendMessage Genkit/AI Error:", e);
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
  console.log('[MOCK SERVER ACTION] getAiPersona INVOKED');
  return JSON.parse(JSON.stringify(personaConfig));
}

export async function updateAiPersonaConfig(description: string): Promise<{
  success: boolean;
  message: string;
  persona?: PersonaConfig;
}> {
  console.log('[MOCK SERVER ACTION] updateAiPersonaConfig INVOKED');
  try {
    const tunedResult = await tuneAiPersona({ personaDescription: description });
    personaConfig.description = tunedResult.updatedPersonaDescription;
    personaConfig.updatedAt = new Date().toISOString();
    return { success: true, message: 'AI Persona updated successfully.', persona: JSON.parse(JSON.stringify(personaConfig)) };
  } catch (e) {
    console.error("updateAiPersonaConfig Genkit/AI Error:", e);
    const errorMessage = e instanceof Error ? e.message : 'Failed to tune persona.';
    return { success: false, message: `Error: ${errorMessage}` };
  }
}

export async function getDocumentSummary(documentId: string): Promise<string | null> {
  console.log(`[MOCK SERVER ACTION] getDocumentSummary INVOKED for documentId: ${documentId}`);
  const document = documents.find(d => d.id === documentId);
  if (document && document.summary) {
    return document.summary;
  }
  if (document && document.status === 'processed' && !document.summary && document.extractedText) {
    console.warn(`[MOCK SERVER ACTION] Document ${documentId} is processed but has no summary. Attempting to generate from extracted text.`);
    try {
      const summaryResult = await summarizeDocument({ documentText: document.extractedText });
      document.summary = summaryResult.summary;
      document.updatedAt = new Date().toISOString();
      return document.summary;
    } catch (e) {
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
  const userId = "mock-user-id"; 
  
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
    errorMessage: undefined,
  };
  documents.push(newDocument); 
  
  const updateDocStatus = (status: DocumentMetadata['status'], errorMessage?: string) => {
    const docIndex = documents.findIndex(d => d.id === newDocumentId);
    if (docIndex > -1) {
      documents[docIndex].status = status;
      documents[docIndex].updatedAt = new Date().toISOString();
      if (errorMessage) {
        documents[docIndex].errorMessage = errorMessage;
      }
    }
  };

  try {
    const storagePath = `uploads/${userId}/${newDocumentId}-${file.name}`;
    const fileStorageRef = ref(storage, storagePath);

    console.log(`[PROCESS PDF LOGIC] Attempting to upload ${file.name} to Firebase Storage: ${storagePath}`);
    await uploadBytes(fileStorageRef, file);
    newDocument.storagePath = fileStorageRef.fullPath;
    
    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.appspot.com`;
    if (!bucketName || !bucketName.includes('.')) { 
        console.error('[PROCESS PDF LOGIC] Failed to determine a valid bucket name from environment variables.');
        updateDocStatus('error', 'Failed to determine storage bucket name. Check Firebase project configuration.');
        return { success: false, message: 'Configuration error: Storage bucket name could not be determined.', documentId: newDocumentId };
    }
    newDocument.gcsUri = `gs://${bucketName}/${newDocument.storagePath}`;
    console.log(`[PROCESS PDF LOGIC] File ${file.name} uploaded to ${newDocument.storagePath}. GCS URI: ${newDocument.gcsUri}.`);
    
    updateDocStatus('extracting_text');
    console.log(`[PROCESS PDF LOGIC] Calling Document AI to extract text from ${newDocument.gcsUri}`);
    
    if (!newDocument.gcsUri) { 
        updateDocStatus('error', 'GCS URI is missing after upload.');
        throw new Error("GCS URI is not available after upload.");
    }
    const extractedText = await extractTextWithDocumentAI(newDocument.gcsUri, file.type);
    newDocument.extractedText = extractedText;
    console.log(`[PROCESS PDF LOGIC] Text extracted for ${newDocumentId}. Length: ${extractedText?.length || 0}.`);

    updateDocStatus('summarizing');
    console.log(`[PROCESS PDF LOGIC] Calling Genkit to summarize document ${newDocumentId}`);
    
    if (!newDocument.extractedText || newDocument.extractedText.trim() === "") {
        console.warn(`[PROCESS PDF LOGIC] Extracted text is empty for ${newDocumentId}. Skipping summarization.`);
        newDocument.summary = "No text content found in the document to summarize.";
    } else {
        const summaryResult = await summarizeDocument({ documentText: newDocument.extractedText });
        newDocument.summary = summaryResult.summary;
    }
    
    updateDocStatus('processed');
    console.log(`[PROCESS PDF LOGIC] Document ${newDocumentId} processed (text extracted and summarized).`);
    
    return {
      success: true,
      message: `File '${file.name}' processed successfully. Text extracted and summarized.`,
      documentId: newDocumentId,
      document: JSON.parse(JSON.stringify(newDocument))
    };

  } catch (error) {
    console.error(`[PROCESS PDF LOGIC] Error during processing for ${file.name}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown processing error';
    updateDocStatus('error', errorMessage);
    return {
      success: false,
      message: `Processing failed for '${file.name}': ${errorMessage}`,
      documentId: newDocumentId // No comma here
    };
  }
}
