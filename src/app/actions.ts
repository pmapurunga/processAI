
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
  console.log("[SERVER ACTION] handlePdfUpload called."); // Entry log

  try {
    console.log("[SERVER ACTION DEBUG] Attempting to access auth object:", typeof auth);
    const currentUser = auth.currentUser;
    // Detailed logging of currentUser. Be cautious with logging sensitive user data in production.
    console.log("[SERVER ACTION DEBUG] auth.currentUser object (properties):", currentUser ? { uid: currentUser.uid, email: currentUser.email, displayName: currentUser.displayName } : 'null');


    if (!currentUser) {
      console.error("[SERVER ACTION ERROR] User not authenticated at the start of handlePdfUpload.");
      return { success: false, message: "User not authenticated. Please log in and try again." };
    }
    const userId = currentUser.uid;
    console.log("[SERVER ACTION DEBUG] Authenticated userId:", userId);

    const file = formData.get('pdfFile') as File;
    if (!file || typeof file.name !== 'string' || file.size === 0) {
      console.error("[SERVER ACTION ERROR] No file or invalid file provided.");
      return { success: false, message: "No file or invalid file provided." };
    }
    console.log("[SERVER ACTION DEBUG] File received:", file.name, file.size, file.type);

    // Validate fileName separately (though file.name is used directly)
    const validatedFields = uploadPdfSchema.safeParse({ fileName: file.name });
    if (!validatedFields.success) {
      console.error("[SERVER ACTION ERROR] Invalid file name based on schema:", validatedFields.error.flatten().fieldErrors);
      return { success: false, message: "Invalid file name." };
    }

    const newDocumentId = `doc${Date.now()}`;
    const filePath = `pendingAnalysis/${userId}/${newDocumentId}/${file.name}`;
    console.log("[SERVER ACTION DEBUG] Target Firebase Storage path:", filePath);

    const fileFirebaseRef = storageRef(storage, filePath);
    console.log("[SERVER ACTION DEBUG] Attempting to upload to Firebase Storage...");
    await uploadBytes(fileFirebaseRef, file);
    console.log("[SERVER ACTION DEBUG] File uploaded successfully to Firebase Storage.");

    const newDocument: DocumentMetadata = {
      id: newDocumentId,
      name: file.name,
      status: 'uploaded',
      uploadedAt: new Date().toISOString(), // Ensure ISO string
      updatedAt: new Date().toISOString(), // Ensure ISO string
      storagePath: filePath,
      userId: userId,
    };
    documents.push(newDocument); // Still using mock data store

    // Simulate processing delay - kept for now, can be removed later
    setTimeout(async () => {
      const docIndex = documents.findIndex(d => d.id === newDocument.id);
      if (docIndex > -1 && documents[docIndex]) { // Check if document still exists
        documents[docIndex].status = 'processing';
        documents[docIndex].updatedAt = new Date().toISOString();
        revalidatePath('/dashboard');

        setTimeout(async () => {
          const finalDocIndex = documents.findIndex(d => d.id === newDocument.id);
          if (finalDocIndex > -1 && documents[finalDocIndex]) { // Check if document still exists
            documents[finalDocIndex].status = 'processed';
            documents[finalDocIndex].updatedAt = new Date().toISOString();
            try {
              // In a real app, fetch the actual document text from storagePath
              const summaryResult = await summarizeDocument({ documentText: `Simulated full text content of ${documents[finalDocIndex].name} stored at ${documents[finalDocIndex].storagePath}` });
              documents[finalDocIndex].summary = summaryResult.summary;
            } catch (error) {
              console.error("[SERVER ACTION ERROR] Error generating summary for new document:", error);
               documents[finalDocIndex].summary = "Error generating summary.";
            }
            revalidatePath('/dashboard');
            revalidatePath(`/summary/${newDocument.id}`);
          }
        }, 10000); // 10 seconds for "processing" to "processed" + summary
      }
    }, 5000); // 5 seconds for "uploaded" to "processing"

    revalidatePath('/dashboard');
    console.log("[SERVER ACTION SUCCESS] handlePdfUpload completed successfully for:", newDocument.name);
    return { success: true, message: `${file.name} uploaded successfully to ${filePath}. Processing started.`, document: newDocument };

  } catch (uploadError: any) {
    console.error("[SERVER ACTION DEBUG] Critical error in handlePdfUpload's main try-catch block:", uploadError);
    
    let clientMessage = "Upload failed due to an unexpected server error. Please check server logs for detailed information.";

    // Attempt to make the error message more specific for the client
    if (uploadError && typeof uploadError.message === 'string') {
      clientMessage = `Upload failed: ${uploadError.message}`;
      if (typeof (uploadError as any).code === 'string') { // Firebase errors often have a code
        clientMessage += ` (Code: ${(uploadError as any).code})`;
      }
    } else if (typeof uploadError === 'string') {
      clientMessage = `Upload failed: ${uploadError}`;
    }
    
    // For server-side logging, try to get more details from the error object
    // This helps in debugging if the error object is not a standard Error instance
    if (uploadError && typeof uploadError === 'object') {
      console.error("[SERVER ACTION DEBUG] Detailed uploadError object (stringified):", JSON.stringify(uploadError, Object.getOwnPropertyNames(uploadError)));
    } else {
      console.error("[SERVER ACTION DEBUG] uploadError (raw):", uploadError);
    }

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
  // Add authorization check here: ensure current user owns the document or has permission

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

  // In a real RAG system, documentChunks would be dynamically fetched based on the query
  // from a vector store, using the document's actual content.
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
  // Add authorization check here

  if (document.summary) return document.summary;

  // This part is still using simulated text.
  // In a real app, you'd download the document from document.storagePath,
  // extract its text, then pass it to summarizeDocument.
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

