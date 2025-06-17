
'use server';

import { z } from 'zod';
import { queryDocument } from '@/ai/flows/query-document';
import { summarizeDocument } from '@/ai/flows/summarize-document';
import { tuneAiPersona } from '@/ai/flows/tune-ai-persona';
import type { DocumentMetadata, ChatMessage, PersonaConfig } from '@/lib/types';
import { revalidatePath } from 'next/cache';
// Intentionally removed:
// import { auth, storage } from '@/lib/firebase'; 
// import { ref as storageRef, uploadBytes } from 'firebase/storage';

// --- Mock Data Store (Replace with actual Firestore interactions) ---
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

const uploadPdfSchema = z.object({
  fileName: z.string().min(1, "File name is required"),
});

export async function handlePdfUpload(formData: FormData): Promise<{ success: boolean; message: string; document?: DocumentMetadata }> {
  console.log("[SERVER ACTION DEBUG] handlePdfUpload called (SIMPLIFIED - NO FIREBASE UPLOAD / NO FIREBASE IMPORTS).");

  try {
    const file = formData.get('pdfFile') as File;
    if (!file || typeof file.name !== 'string' || file.size === 0) {
      console.error("[SERVER ACTION ERROR] No file or invalid file provided.");
      return { success: false, message: "No file or invalid file provided." };
    }
    console.log("[SERVER ACTION DEBUG] File received:", file.name, file.size, file.type);

    const validatedFields = uploadPdfSchema.safeParse({ fileName: file.name });
    if (!validatedFields.success) {
      const errorMessages = validatedFields.error.flatten().fieldErrors;
      const prettyError = JSON.stringify(errorMessages, null, 2);
      console.error("[SERVER ACTION ERROR] Invalid file name based on schema:", prettyError);
      return { success: false, message: `Invalid file name. Details: ${prettyError}` };
    }
    console.log("[SERVER ACTION DEBUG] File name validated.");

    const newDocumentId = `doc${Date.now()}`;
    const mockUserId = "SIMULATED_USER_ID_NO_FIREBASE_UPLOAD"; 

    const newDocument: DocumentMetadata = {
      id: newDocumentId,
      name: file.name,
      status: 'uploaded', 
      uploadedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      storagePath: `simulated/pendingAnalysis/${mockUserId}/${newDocumentId}/${file.name}`, 
      userId: mockUserId,
    };

    console.log("[SERVER ACTION DEBUG] Mock document created:", JSON.stringify(newDocument));
    documents.push(newDocument); 
    console.log("[SERVER ACTION DEBUG] Mock document pushed to in-memory array.");

    setTimeout(async () => {
      const docIndex = documents.findIndex(d => d.id === newDocument.id);
      if (docIndex > -1 && documents[docIndex]) { 
        documents[docIndex].status = 'processing';
        documents[docIndex].updatedAt = new Date().toISOString();
        console.log(`[SERVER ACTION DEBUG] Document ${newDocument.id} status changed to 'processing' (simulated).`);
        revalidatePath('/dashboard');

        setTimeout(async () => {
          const finalDocIndex = documents.findIndex(d => d.id === newDocument.id);
          if (finalDocIndex > -1 && documents[finalDocIndex]) { 
            documents[finalDocIndex].status = 'processed';
            documents[finalDocIndex].updatedAt = new Date().toISOString();
            console.log(`[SERVER ACTION DEBUG] Document ${newDocument.id} status changed to 'processed' (simulated).`);
            try {
              const summaryResult = await summarizeDocument({ documentText: `Simulated full text content of ${documents[finalDocIndex].name} stored at ${documents[finalDocIndex].storagePath}` });
              documents[finalDocIndex].summary = summaryResult.summary;
              console.log(`[SERVER ACTION DEBUG] Summary generated for ${newDocument.id} (simulated).`);
            } catch (error) {
              console.error("[SERVER ACTION ERROR] Error generating summary for new document (in simplified test):", error);
               documents[finalDocIndex].summary = "Error generating summary.";
            }
            revalidatePath('/dashboard');
            revalidatePath(`/summary/${newDocument.id}`);
          }
        }, 10000); 
      }
    }, 5000); 

    revalidatePath('/dashboard');
    console.log("[SERVER ACTION SUCCESS] handlePdfUpload completed (SIMPLIFIED - NO FIREBASE UPLOAD). File:", newDocument.name);
    return { 
      success: true, 
      message: `${file.name} upload process SIMULATED. No actual Firebase upload or SDKs involved directly in this action. Document added to mock list.`, 
      document: newDocument 
    };

  } catch (error: any) {
    console.error("[SERVER ACTION DEBUG] Critical error in handlePdfUpload's main try-catch block (SIMPLIFIED TEST - NO FIREBASE IMPORTS).");
    
    let clientMessage = "Upload failed during SIMPLIFIED TEST (NO FIREBASE IMPORTS) due to an unexpected server error. Please check server logs for detailed information.";

    if (error && typeof error.message === 'string') {
      clientMessage = `Upload failed (SIMPLIFIED TEST - NO FIREBASE IMPORTS): ${error.message}`;
    } else if (typeof error === 'string') {
      clientMessage = `Upload failed (SIMPLIFIED TEST - NO FIREBASE IMPORTS): ${error}`;
    }
    
    if (error && typeof error === 'object') {
        console.error("[SERVER ACTION DEBUG] Detailed uploadError object (stringified SIMPLIFIED TEST - NO FIREBASE IMPORTS):", JSON.stringify(error, Object.getOwnPropertyNames(error)));
    } else {
        console.error("[SERVER ACTION DEBUG] uploadError (raw, non-object, SIMPLIFIED TEST - NO FIREBASE IMPORTS):", error);
    }
    
    return { success: false, message: clientMessage };
  }
}


// --- Chat Actions ---
// WARNING: These actions might be broken by removal of Firebase SDK imports if they relied on them.
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
    `Content related to ${document.name}. Chunk 1. This is retrieved based on user query from document ${document.storagePath}.`,
    `More content from ${document.name}. Chunk 2. This part might be relevant to the user query: ${message}.`,
    `Persona instructions: ${personaConfig.description}`
  ];

  try {
    const aiResponse = await queryDocument({
      query: message,
      documentChunks: mockDocumentChunks,
    });

    const aiMessage: ChatMessage = {
      id: `msg${Date.now() + 1}`,
      documentId,
      role: 'assistant',
      content: aiResponse.answer,
      timestamp: Date.now(),
    };
    chatMessages[documentId].push(aiMessage);
    revalidatePath(`/chat/${documentId}`);
    return { success: true, userMessage, aiMessage };

  } catch (error) {
    console.error("Error querying document:", error);
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
// WARNING: These actions might be broken by removal of Firebase SDK imports if they relied on them.
export async function getDocumentSummary(documentId: string): Promise<string | null> {
  const document = await getDocumentById(documentId);
  if (!document || document.status !== 'processed') return null;

  if (document.summary) return document.summary;

  try {
    const summaryResult = await summarizeDocument({ documentText: `Full text content of ${document.name} (from ${document.storagePath}). This is a placeholder for actual document content.` });
    const docIndex = documents.findIndex(d => d.id === documentId);
    if (docIndex > -1) {
      documents[docIndex].summary = summaryResult.summary;
      documents[docIndex].updatedAt = new Date().toISOString();
      revalidatePath(`/summary/${documentId}`);
      revalidatePath('/dashboard'); 
    }
    return summaryResult.summary;
  } catch (error) {
    console.error("Error generating summary:", error);
    return "Could not generate summary at this time.";
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
    const result = await tuneAiPersona({ personaDescription: description });
    personaConfig.description = result.updatedPersonaDescription;
    personaConfig.updatedAt = new Date().toISOString();
    revalidatePath('/admin/persona');
    return { success: true, message: "AI Persona updated successfully.", persona: personaConfig };
  } catch (error) {
    console.error("Error updating AI persona:", error);
    const errMessage = error instanceof Error ? error.message : "Unknown error";
    return { success: false, message: `Failed to update AI persona: ${errMessage}` };
  }
}
