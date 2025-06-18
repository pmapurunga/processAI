
'use server';

import type { DocumentMetadata, ChatMessage, PersonaConfig } from '@/lib/types';
import { storage } from '@/lib/firebase'; // Import Firebase Storage
import { ref, uploadBytes } from 'firebase/storage';
import { summarizeDocument } from '@/ai/flows/summarize-document'; // Import Genkit flow
import { queryDocument } from '@/ai/flows/query-document';
import { tuneAiPersona } from '@/ai/flows/tune-ai-persona';


// Mock data store (simulando um banco de dados em memória)
let documents: DocumentMetadata[] = [
  {
    id: 'mock-doc-1',
    name: 'Sample Document 1.pdf',
    status: 'processed',
    uploadedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Yesterday
    updatedAt: new Date().toISOString(),
    summary: 'This is a mock summary for Sample Document 1.',
    userId: 'mock-user-1',
    storagePath: 'mock-path/Sample Document 1.pdf'
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
  console.log(`sendMessage called with id: ${data.documentId}`); // MODIFIED LINE
  const document = documents.find(d => d.id === data.documentId);
  if (!document || document.status !== 'processed') {
    return { success: false, error: 'Document not found or not processed.' };
  }

  const userMessage: ChatMessage = {
    id: `user-${Date.now()}`,
    documentId: data.documentId,
    role: 'user',
    content: data.message,
    timestamp: Date.now(),
  };
  chatMessages.push(userMessage);

  const mockDocumentChunks = document.summary ? document.summary.split('. ') : [`Mock content for ${document.name}`];
  try {
    const aiResponse = await queryDocument({ query: data.message, documentChunks: mockDocumentChunks });

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
  if (document && document.status === 'processed' && !document.summary) {
    // This case might indicate a document processed before summary generation was robust
    // Or if a re-summarization is needed. For now, we'll assume summary should exist.
    console.warn(`[SERVER ACTION DEBUG] Document ${documentId} is processed but has no summary. Attempting to generate.`);
    try {
      // This would require having the document text available or re-fetching it.
      // For this mock, we can't easily re-summarize without the original text.
      // In a real system, you might re-trigger processing or fetch from storage.
      const mockText = `Mock content for ${document.name} needing re-summarization.`;
      const summaryResult = await summarizeDocument({ documentText: mockText });
      document.summary = summaryResult.summary;
      document.updatedAt = new Date().toISOString();
      return document.summary;
    } catch (e) {
      console.error("[SERVER ACTION DEBUG] getDocumentSummary Genkit/AI Error on re-summarization:", e);
      return "Error re-generating summary.";
    }
  }
  if (document && document.status === 'processing') {
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
  // For a real app, get actual userId from session or an auth token passed to the API route
  const userId = "mock-user-id"; 
  const storagePath = `uploads/${userId}/${newDocumentId}-${file.name}`;
  const fileStorageRef = ref(storage, storagePath);

  const newDocument: DocumentMetadata = {
    id: newDocumentId,
    name: file.name,
    status: 'uploaded', 
    uploadedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    userId: userId,
    storagePath: undefined, // Will be set after successful upload
    summary: undefined,
  };
  documents.push(newDocument); // Add to mock DB optimistically

  try {
    console.log(`[PROCESS PDF LOGIC] Attempting to upload ${file.name} to ${storagePath}`);
    await uploadBytes(fileStorageRef, file);
    newDocument.storagePath = fileStorageRef.fullPath;
    newDocument.status = 'processing';
    newDocument.updatedAt = new Date().toISOString();
    console.log(`[PROCESS PDF LOGIC] File ${file.name} uploaded to ${newDocument.storagePath}. Status: processing.`);

    // Simulate text extraction - In a real app, you'd use a PDF parsing library here.
    const mockDocumentText = `Simulated text content for PDF: ${file.name}. This document discusses various advanced topics in theoretical physics and their practical applications in modern technology. It covers quantum mechanics, string theory, and astrophysics.`;
    
    console.log(`[PROCESS PDF LOGIC] Calling Genkit to summarize document ${newDocumentId}`);
    try {
      const summaryResult = await summarizeDocument({ documentText: mockDocumentText });
      newDocument.summary = summaryResult.summary;
      newDocument.status = 'processed';
      newDocument.updatedAt = new Date().toISOString();
      console.log(`[PROCESS PDF LOGIC] Document ${newDocumentId} summarized. Status: processed.`);
      return {
        success: true,
        message: `File '${file.name}' uploaded and summarized successfully.`,
        documentId: newDocumentId,
        document: JSON.parse(JSON.stringify(newDocument))
      };
    } catch (genkitError) {
      console.error(`[PROCESS PDF LOGIC] Genkit summarization error for ${newDocumentId}:`, genkitError);
      newDocument.status = 'error';
      newDocument.updatedAt = new Date().toISOString();
      return {
        success: false,
        message: `File uploaded, but summarization failed: ${genkitError instanceof Error ? genkitError.message : 'Unknown AI error'}`,
        documentId: newDocumentId,
        document: JSON.parse(JSON.stringify(newDocument))
      };
    }

  } catch (uploadError) {
    console.error(`[PROCESS PDF LOGIC] Firebase Storage upload error for ${file.name}:`, uploadError);
    // Remove the optimistic document add or mark as error if it was added
    const docIndex = documents.findIndex(d => d.id === newDocumentId);
    if (docIndex > -1) {
        documents[docIndex].status = 'error';
        documents[docIndex].updatedAt = new Date().toISOString();
    }
    return {
      success: false,
      message: `Failed to upload file to Firebase Storage: ${uploadError instanceof Error ? uploadError.message : 'Unknown storage error'}`,
      documentId: newDocumentId, // still pass ID for potential cleanup or retry logic
    };
  }
}

    