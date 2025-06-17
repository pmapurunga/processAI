
'use server';

import type { DocumentMetadata, ChatMessage, PersonaConfig } from '@/lib/types';
import { queryDocument } from '@/ai/flows/query-document';
import { summarizeDocument } from '@/ai/flows/summarize-document';
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


// --- Funções Restauradas com Lógica Mock ---

export async function getDocuments(): Promise<DocumentMetadata[]> {
  console.log('[SERVER ACTION DEBUG] getDocuments INVOKED (MOCK)');
  return JSON.parse(JSON.stringify(documents)); // Retorna uma cópia para evitar mutação direta
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
  console.log(`[SERVER ACTION DEBUG] sendMessage INVOKED for documentId: ${data.documentId} (MOCK)`);
  
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

  try {
    // Simular chamada RAG com Genkit (assumindo que document.summary ou chunks estariam disponíveis)
    constchunks = document.summary ? document.summary.split('. ') : ['Mock document content.'];
    const aiResponse = await queryDocument({ query: data.message, documentChunks:chunks });

    const aiMessage: ChatMessage = {
      id: `ai-${Date.now()}`,
      documentId: data.documentId,
      role: 'assistant',
      content: aiResponse.answer || "I'm having trouble responding right now.",
      timestamp: Date.now() + 1, // Ensure AI message is later
    };
    chatMessages.push(aiMessage);
    return { success: true, userMessage: JSON.parse(JSON.stringify(userMessage)), aiMessage: JSON.parse(JSON.stringify(aiMessage)) };
  } catch (e) {
    console.error("[SERVER ACTION DEBUG] sendMessage Genkit Error (MOCK):", e);
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
  console.log('[SERVER ACTION DEBUG] updateAiPersonaConfig INVOKED (MOCK)');
  try {
    const tunedResult = await tuneAiPersona({ personaDescription: description });
    personaConfig.description = tunedResult.updatedPersonaDescription;
    personaConfig.updatedAt = new Date().toISOString();
    return { success: true, message: 'AI Persona updated successfully via Genkit (MOCK).', persona: JSON.parse(JSON.stringify(personaConfig)) };
  } catch (e) {
    console.error("[SERVER ACTION DEBUG] updateAiPersonaConfig Genkit Error (MOCK):", e);
    const errorMessage = e instanceof Error ? e.message : 'Failed to tune persona via Genkit.';
    return { success: false, message: `Error: ${errorMessage}` };
  }
}

export async function getDocumentSummary(documentId: string): Promise<string | null> {
  console.log(`[SERVER ACTION DEBUG] getDocumentSummary INVOKED for documentId: ${documentId} (MOCK)`);
  const document = documents.find(d => d.id === documentId);
  if (document && document.summary) {
    return document.summary;
  }
  if (document && document.status === 'processed' && !document.summary) {
    // Simulate generating summary if not present
    try {
      const summaryResult = await summarizeDocument({ documentText: "This is mock document text for " + document.name });
      document.summary = summaryResult.summary;
      return document.summary;
    } catch (e) {
      console.error("[SERVER ACTION DEBUG] getDocumentSummary Genkit Error (MOCK):", e);
      return "Error generating summary.";
    }
  }
  return null;
}

// --- handlePdfUpload (extremamente simplificada) ---
export async function handlePdfUpload(formData: FormData): Promise<{ success: boolean; message: string; documentId?: string }> {
  console.log("[SERVER ACTION DEBUG] handlePdfUpload INVOKED (EXTREMELY SIMPLIFIED - FormData NOT ACCESSED).");
  // Não acessaremos `formData` de forma alguma nesta versão.
  // O objetivo é testar se a própria infraestrutura da Server Action consegue lidar com
  // uma assinatura FormData e retornar uma resposta.
  
  // Removido o try...catch intencionalmente para ver se o erro ocorre antes mesmo disso.
  // Se a action falhar antes de retornar, o Next.js pode enviar a "unexpected response".

  return {
    success: true,
    message: "Server action handlePdfUpload invoked (EXTREMELY SIMPLIFIED - FormData NOT ACCESSED) and returned hardcoded success.",
    documentId: "sim-doc-id-very-extreme"
  };
}
