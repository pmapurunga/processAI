
'use server';

import { z } from 'zod';
import { queryDocument } from '@/ai/flows/query-document';
import { summarizeDocument } from '@/ai/flows/summarize-document';
import { tuneAiPersona } from '@/ai/flows/tune-ai-persona';
import type { DocumentMetadata, ChatMessage, PersonaConfig } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { auth, storage } from '@/lib/firebase'; // Import auth
import { ref as storageRef, uploadBytes } from 'firebase/storage';

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
  // In a real app, fetch from Firestore
  // Filter by current user if needed, or handle authorization server-side
  return Promise.resolve(documents.sort((a,b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()));
}

export async function getDocumentById(id: string): Promise<DocumentMetadata | undefined> {
  // Add authorization check if necessary
  return Promise.resolve(documents.find(doc => doc.id === id));
}

// Simulate PDF upload and initial processing
const uploadPdfSchema = z.object({
  fileName: z.string().min(1, "File name is required"),
});

export async function handlePdfUpload(formData: FormData): Promise<{ success: boolean; message: string; document?: DocumentMetadata }> {
  console.log("[SERVER ACTION DEBUG] handlePdfUpload called.");

  try {
    // Temporarily use a mock userId to isolate auth issues
    const mockUserId = "MOCK_USER_ID_FOR_DEBUGGING";
    console.log("[SERVER ACTION DEBUG] Using mockUserId:", mockUserId);

    // Attempt to log current user if available, but don't rely on it for path yet
    try {
        const currentUser = auth.currentUser;
        if (currentUser) {
            console.log("[SERVER ACTION DEBUG] auth.currentUser is available. UID:", currentUser.uid);
        } else {
            console.log("[SERVER ACTION DEBUG] auth.currentUser is NULL at the start of handlePdfUpload.");
        }
    } catch (authError) {
        console.error("[SERVER ACTION DEBUG] Error accessing auth.currentUser:", authError);
    }

    const file = formData.get('pdfFile') as File;
    if (!file || typeof file.name !== 'string' || file.size === 0) {
      console.error("[SERVER ACTION ERROR] No file or invalid file provided.");
      return { success: false, message: "No file or invalid file provided." };
    }
    console.log("[SERVER ACTION DEBUG] File received:", file.name, file.size, file.type);

    const validatedFields = uploadPdfSchema.safeParse({ fileName: file.name });
    if (!validatedFields.success) {
      console.error("[SERVER ACTION ERROR] Invalid file name based on schema:", validatedFields.error.flatten().fieldErrors);
      return { success: false, message: "Invalid file name." };
    }

    const newDocumentId = `doc${Date.now()}`;
    // Use mockUserId for path construction
    const filePath = `pendingAnalysis/${mockUserId}/${newDocumentId}/${file.name}`;
    console.log("[SERVER ACTION DEBUG] Target Firebase Storage path (using mockUserId):", filePath);

    const fileFirebaseRef = storageRef(storage, filePath);
    console.log("[SERVER ACTION DEBUG] Attempting to upload to Firebase Storage...");
    await uploadBytes(fileFirebaseRef, file);
    console.log("[SERVER ACTION DEBUG] File uploaded successfully to Firebase Storage (or so it seems if no error thrown).");

    const newDocument: DocumentMetadata = {
      id: newDocumentId,
      name: file.name,
      status: 'uploaded',
      uploadedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      storagePath: filePath,
      userId: mockUserId, // Use mockUserId here as well
    };
    documents.push(newDocument); 

    // Simulate processing delay
    setTimeout(async () => {
      const docIndex = documents.findIndex(d => d.id === newDocument.id);
      if (docIndex > -1 && documents[docIndex]) { 
        documents[docIndex].status = 'processing';
        documents[docIndex].updatedAt = new Date().toISOString();
        revalidatePath('/dashboard');

        setTimeout(async () => {
          const finalDocIndex = documents.findIndex(d => d.id === newDocument.id);
          if (finalDocIndex > -1 && documents[finalDocIndex]) { 
            documents[finalDocIndex].status = 'processed';
            documents[finalDocIndex].updatedAt = new Date().toISOString();
            try {
              const summaryResult = await summarizeDocument({ documentText: `Simulated full text content of ${documents[finalDocIndex].name} stored at ${documents[finalDocIndex].storagePath}` });
              documents[finalDocIndex].summary = summaryResult.summary;
            } catch (error) {
              console.error("[SERVER ACTION ERROR] Error generating summary for new document:", error);
               documents[finalDocIndex].summary = "Error generating summary.";
            }
            revalidatePath('/dashboard');
            revalidatePath(`/summary/${newDocument.id}`);
          }
        }, 10000); 
      }
    }, 5000); 

    revalidatePath('/dashboard');
    console.log("[SERVER ACTION SUCCESS] handlePdfUpload completed (potentially with mock data or failed upload due to mockUserId). File:", newDocument.name);
    return { success: true, message: `${file.name} upload process initiated with mock user. Check server logs and storage for actual status.`, document: newDocument };

  } catch (uploadError: any) {
    console.error("[SERVER ACTION DEBUG] Critical error in handlePdfUpload's main try-catch block.");
    
    let clientMessage = "Upload failed due to an unexpected server error. Please check server logs for detailed information.";

    if (uploadError && typeof uploadError.message === 'string') {
      clientMessage = `Upload failed: ${uploadError.message}`;
      if (typeof (uploadError as any).code === 'string') { 
        clientMessage += ` (Code: ${(uploadError as any).code})`;
      }
    } else if (typeof uploadError === 'string') {
      clientMessage = `Upload failed: ${uploadError}`;
    }
    
    // Log detailed error object for server-side debugging
    if (uploadError && typeof uploadError === 'object') {
        console.error("[SERVER ACTION DEBUG] Detailed uploadError object (stringified):", JSON.stringify(uploadError, Object.getOwnPropertyNames(uploadError)));
    } else {
        console.error("[SERVER ACTION DEBUG] uploadError (raw, non-object):", uploadError);
    }
    console.error("[SERVER ACTION DEBUG] Raw error details:", uploadError);


    return { success: false, message: clientMessage };
  }
}


// --- Chat Actions ---
export async function getChatMessages(documentId: string): Promise<ChatMessage[]> {
  // Add authorization: Ensure user can only access their own document's chat
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
