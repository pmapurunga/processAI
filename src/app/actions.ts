
'use server';

import type { DocumentMetadata, ChatMessage, PersonaConfig } from '@/lib/types';
// Removidas importações diretas de SDKs Firebase client-side (auth, storage) que podem causar problemas em Server Actions.
// As funções que dependiam delas precisarão ser ajustadas ou usar SDKs Admin se chamadas do servidor.

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

  // Simulação de chamada Genkit (assumindo que os chunks viriam de algum lugar)
  const mockDocumentChunks = document.summary ? document.summary.split('. ') : ['Mock document content for chat.'];
  try {
    // const { queryDocument } = await import('@/ai/flows/query-document'); // Import dinâmico se necessário
    // const aiResponse = await queryDocument({ query: data.message, documentChunks: mockDocumentChunks });
    const aiSimulatedResponse = { answer: `AI response to: "${data.message}" based on ${document.name}`};

    const aiMessage: ChatMessage = {
      id: `ai-${Date.now()}`,
      documentId: data.documentId,
      role: 'assistant',
      content: aiSimulatedResponse.answer || "I'm having trouble responding right now.",
      timestamp: Date.now() + 1,
    };
    chatMessages.push(aiMessage);
    return { success: true, userMessage: JSON.parse(JSON.stringify(userMessage)), aiMessage: JSON.parse(JSON.stringify(aiMessage)) };
  } catch (e) {
    console.error("[SERVER ACTION DEBUG] sendMessage Genkit/AI Error (MOCK):", e);
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
    // const { tuneAiPersona } = await import('@/ai/flows/tune-ai-persona'); // Import dinâmico se necessário
    // const tunedResult = await tuneAiPersona({ personaDescription: description });
    const tunedSimulatedResult = { updatedPersonaDescription: description };
    personaConfig.description = tunedSimulatedResult.updatedPersonaDescription;
    personaConfig.updatedAt = new Date().toISOString();
    return { success: true, message: 'AI Persona updated successfully (MOCK).', persona: JSON.parse(JSON.stringify(personaConfig)) };
  } catch (e) {
    console.error("[SERVER ACTION DEBUG] updateAiPersonaConfig Genkit/AI Error (MOCK):", e);
    const errorMessage = e instanceof Error ? e.message : 'Failed to tune persona.';
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
      // const { summarizeDocument } = await import('@/ai/flows/summarize-document'); // Import dinâmico
      // const summaryResult = await summarizeDocument({ documentText: "This is mock document text for " + document.name });
      const summarySimulatedResult = { summary: "This is a dynamically generated MOCK summary for " + document.name };
      document.summary = summarySimulatedResult.summary;
      return document.summary;
    } catch (e) {
      console.error("[SERVER ACTION DEBUG] getDocumentSummary Genkit/AI Error (MOCK):", e);
      return "Error generating summary (MOCK).";
    }
  }
  return null;
}


// Esta função será chamada pelo Route Handler em /api/upload/route.ts
// Ela não é mais uma Server Action exportada diretamente para o formulário.
export async function processPdfUploadLogic(formData: FormData): Promise<{ success: boolean; message: string; documentId?: string }> {
  console.log("[PROCESS PDF LOGIC] processPdfUploadLogic INVOKED (VERY SIMPLIFIED)");

  const fileEntry = formData.get('pdfFile');

  if (!fileEntry || !(fileEntry instanceof File)) {
    console.log("[PROCESS PDF LOGIC] No file found in FormData or not a File instance.");
    return { success: false, message: "No file found in form data." };
  }

  const file = fileEntry as File;
  console.log(`[PROCESS PDF LOGIC] File Name: ${file.name}, File Size: ${file.size}, File Type: ${file.type}`);

  if (!file.name.toLowerCase().endsWith('.pdf')) {
     console.log("[PROCESS PDF LOGIC] Invalid file type, not a PDF.");
    return { success: false, message: "Invalid file type. Only PDF is allowed." };
  }
  
  // SIMULAÇÃO EXTREMA:
  // Apenas cria um novo registro de documento mockado.
  // Nenhuma interação real com Firebase Storage ou Genkit aqui para isolar o problema do 400.
  const newDocumentId = `sim-doc-${Date.now()}`;
  const newDocument: DocumentMetadata = {
    id: newDocumentId,
    name: file.name,
    status: 'uploaded', // Simula que o upload (para algum lugar) foi feito
    uploadedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    userId: "sim-user-id", // Placeholder
    storagePath: `simulated_uploads/${file.name}` // Placeholder
  };
  documents.push(newDocument);
  console.log("[PROCESS PDF LOGIC] Simulated new document:", newDocument);

  // Simula um pequeno atraso, como se estivesse processando
  await new Promise(resolve => setTimeout(resolve, 500));

  return {
    success: true,
    message: `File '${file.name}' SIMULATED upload process started. Document ID: ${newDocumentId}. (No actual Firebase upload)`,
    documentId: newDocumentId,
  };
}
