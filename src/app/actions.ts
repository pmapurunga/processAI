
'use server';

import { z } from 'zod';
// import { queryDocument } from '@/ai/flows/query-document'; // Temporarily unused
// import { summarizeDocument } from '@/ai/flows/summarize-document'; // Temporarily unused
// import { tuneAiPersona } from '@/ai/flows/tune-ai-persona'; // Temporarily unused
import type { DocumentMetadata, ChatMessage, PersonaConfig } from '@/lib/types';
import { revalidatePath } from 'next/cache';

// --- Mock Data Store (Remains for other actions, but handlePdfUpload will be simplified) ---
let documents: DocumentMetadata[] = [
  { id: 'doc1', name: 'Annual Report 2023.pdf', status: 'processed', uploadedAt: new Date(Date.now() - 86400000 * 2).toISOString(), updatedAt: new Date().toISOString(), summary: 'This is a brief summary of the annual report.', userId: 'mockUser1' },
  { id: 'doc2', name: 'Project Phoenix Proposal.pdf', status: 'processing', uploadedAt: new Date(Date.now() - 86400000).toISOString(), updatedAt: new Date().toISOString(), userId: 'mockUser1' },
  { id: 'doc3', name: 'Research Paper on AI.pdf', status: 'error', uploadedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), userId: 'mockUser2' },
];

let chatMessages: Record<string, ChatMessage[]> = {
  doc1: [
    { id: 'msg1', documentId: 'doc1', role: 'assistant', content: 'Hello! How can I help you with the Annual Report 2023?', timestamp: Date.now() - 10000 },
  ],
};

let personaConfig: PersonaConfig = {
  description: "You are a helpful and professional AI assistant. Your responses should be concise, accurate, and based strictly on the provided document context. Maintain a formal and respectful tone.",
  updatedAt: new Date().toISOString(),
};
// --- End Mock Data Store ---

// --- Document Actions ---
export async function getDocuments(): Promise<DocumentMetadata[]> {
  return Promise.resolve(documents.sort((a,b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()));
}

export async function getDocumentById(id: string): Promise<DocumentMetadata | undefined> {
  return Promise.resolve(documents.find(doc => doc.id === id));
}


export async function handlePdfUpload(formData: FormData): Promise<{ success: boolean; message: string; documentId?: string }> {
  console.log("[SERVER ACTION DEBUG] handlePdfUpload INVOKED.");
  console.log("[SERVER ACTION DEBUG] Received formData object:", formData);

  try {
    // Try to log keys to see if formData is populated on the server
    const formDataKeys = [];
    for (const key of formData.keys()) {
      formDataKeys.push(key);
    }
    console.log("[SERVER ACTION DEBUG] FormData keys found on server:", formDataKeys);

    const fileCandidate = formData.get('pdfFile');
    if (fileCandidate instanceof File) {
      console.log(`[SERVER ACTION DEBUG] 'pdfFile' is a File. Name: ${fileCandidate.name}, Size: ${fileCandidate.size}, Type: ${fileCandidate.type}`);
    } else if (fileCandidate) {
      console.log(`[SERVER ACTION DEBUG] 'pdfFile' exists but is not a File. Type: ${typeof fileCandidate}, Value:`, fileCandidate);
    } else {
      console.log("[SERVER ACTION DEBUG] 'pdfFile' not found in FormData.");
    }

  } catch (err: any) {
    console.error("[SERVER ACTION DEBUG] Error inspecting formData on server:", err.message);
  }

  // Hardcoded success, no actual processing or validation for extreme debugging
  // This is to check if the Server Action can return *any* valid JSON response
  // when it's supposed to handle FormData.
  return { success: true, message: "Server action handlePdfUpload invoked and returned hardcoded success (SIMULATED - NO ACTUAL PROCESSING).", documentId: "sim-doc-id-hardcoded" };
}


// --- Chat Actions ---
export async function getChatMessages(documentId: string): Promise<ChatMessage[]> {
  return Promise.resolve(chatMessages[documentId] || []);
}

const sendMessageSchema = z.object({
  documentId: z.string(),
  message: z.string().min(1),
});

export async function sendMessage(input: { documentId: string; message: string }): Promise<{ success: boolean; userMessage?: ChatMessage; aiMessage?: ChatMessage; error?: string }> {
  const validation = sendMessageSchema.safeParse(input);
  if (!validation.success) {
    return { success: false, error: "Invalid input" };
  }
  const { documentId, message } = validation.data;

  const document = await getDocumentById(documentId);
  if (!document || document.status !== 'processed') {
    return { success: false, error: "Document not found or not processed." };
  }

  const userMessage: ChatMessage = {
    id: `msg${Date.now()}`,
    documentId,
    role: 'user',
    content: message,
    timestamp: Date.now(),
  };

  if (!chatMessages[documentId]) {
    chatMessages[documentId] = [];
  }
  chatMessages[documentId].push(userMessage);

  const mockDocumentChunks = [
    `Content related to ${document.name}. Chunk 1.`,
    `More content from ${document.name}. Chunk 2. Relevant to: ${message}.`,
    `Persona instructions: ${personaConfig.description}`
  ];

  try {
    // const aiResponse = await queryDocument({ // queryDocument is temporarily commented out
    //   query: message,
    //   documentChunks: mockDocumentChunks,
    // });
    const mockAiResponse = { answer: `This is a mock AI response to: "${message}" for document ${document.name}. Persona: ${personaConfig.description}` };


    const aiMessage: ChatMessage = {
      id: `msg${Date.now() + 1}`,
      documentId,
      role: 'assistant',
      // content: aiResponse.answer,
      content: mockAiResponse.answer,
      timestamp: Date.now(),
    };
    chatMessages[documentId].push(aiMessage);
    revalidatePath(`/chat/${documentId}`);
    return { success: true, userMessage, aiMessage };

  } catch (error) {
    console.error("Error querying document (or mock error):", error);
    const errMessage = error instanceof Error ? error.message : "Unknown error";
    const aiErrorMessage: ChatMessage = {
      id: `msg${Date.now() + 1}`,
      documentId,
      role: 'assistant',
      content: `Sorry, I encountered an error processing your request: ${errMessage}`,
      timestamp: Date.now(),
    };
    chatMessages[documentId].push(aiErrorMessage);
    revalidatePath(`/chat/${documentId}`);
    return { success: false, userMessage, aiMessage: aiErrorMessage, error: `Failed to get AI response: ${errMessage}` };
  }
}

// --- Summarization Actions ---
export async function getDocumentSummary(documentId: string): Promise<string | null> {
  const document = await getDocumentById(documentId);
  if (!document || document.status !== 'processed') return null;

  if (document.summary) return document.summary;

  try {
    // const summaryResult = await summarizeDocument({ documentText: `Full text content of ${document.name}.` }); // summarizeDocument is temporarily commented out
    const mockSummary = `This is a mock summary for ${document.name}. Actual summarization is pending.`;
    const docIndex = documents.findIndex(d => d.id === documentId);
    if (docIndex > -1) {
      documents[docIndex].summary = mockSummary; // summaryResult.summary;
      documents[docIndex].updatedAt = new Date().toISOString();
      revalidatePath(`/summary/${documentId}`);
      revalidatePath('/dashboard');
    }
    return mockSummary; // summaryResult.summary;
  } catch (error) {
    console.error("Error generating summary (or mock error):", error);
    return "Could not generate summary at this time (mock error).";
  }
}

// --- AI Persona Actions ---
export async function getAiPersona(): Promise<PersonaConfig> {
  return Promise.resolve(personaConfig);
}

const updatePersonaSchema = z.object({
  description: z.string().min(10, "Persona description is too short."),
});
export async function updateAiPersonaConfig(description: string): Promise<{ success: boolean; message: string; persona?: PersonaConfig }> {
  const validation = updatePersonaSchema.safeParse({ description });
  if (!validation.success) {
    return { success: false, message: validation.error.flatten().fieldErrors.description?.[0] || "Invalid description" };
  }
  
  try {
    // const result = await tuneAiPersona({ personaDescription: description }); // tuneAiPersona is temporarily commented out
    const mockResult = { updatedPersonaDescription: description };
    personaConfig.description = mockResult.updatedPersonaDescription; // result.updatedPersonaDescription;
    personaConfig.updatedAt = new Date().toISOString();
    revalidatePath('/admin/persona');
    return { success: true, message: "AI Persona updated successfully (mock).", persona: personaConfig };
  } catch (error) {
    console.error("Error updating AI persona (or mock error):", error);
    const errMessage = error instanceof Error ? error.message : "Unknown error";
    return { success: false, message: `Failed to update AI persona (mock error): ${errMessage}` };
  }
}
