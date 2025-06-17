'use server';

import { z } from 'zod';
import { queryDocument } from '@/ai/flows/query-document';
import { summarizeDocument } from '@/ai/flows/summarize-document';
import { tuneAiPersona } from '@/ai/flows/tune-ai-persona';
import type { DocumentMetadata, ChatMessage, PersonaConfig } from '@/lib/types';
import { revalidatePath } from 'next/cache';

// --- Mock Data Store (Replace with actual Firestore interactions) ---
let documents: DocumentMetadata[] = [
  { id: 'doc1', name: 'Annual Report 2023.pdf', status: 'processed', uploadedAt: new Date(Date.now() - 86400000 * 2).toISOString(), updatedAt: new Date().toISOString(), summary: 'This is a brief summary of the annual report.' },
  { id: 'doc2', name: 'Project Phoenix Proposal.pdf', status: 'processing', uploadedAt: new Date(Date.now() - 86400000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'doc3', name: 'Research Paper on AI.pdf', status: 'error', uploadedAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
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
  return Promise.resolve(documents.sort((a,b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()));
}

export async function getDocumentById(id: string): Promise<DocumentMetadata | undefined> {
  return Promise.resolve(documents.find(doc => doc.id === id));
}

// Simulate PDF upload and initial processing
const uploadPdfSchema = z.object({
  fileName: z.string().min(1, "File name is required"),
});
export async function handlePdfUpload(formData: FormData): Promise<{ success: boolean; message: string; document?: DocumentMetadata }> {
  const validatedFields = uploadPdfSchema.safeParse({
    fileName: formData.get('pdfFile') ? (formData.get('pdfFile') as File).name : '',
  });

  if (!validatedFields.success) {
    return { success: false, message: "Invalid file name." };
  }
  
  const file = formData.get('pdfFile') as File;
  if (!file || typeof file.name !== 'string' || file.size === 0) {
    return { success: false, message: "No file or invalid file provided." };
  }

  // Simulate upload to Firebase Storage & Cloud Function trigger
  // In a real app, this would involve Firebase SDKs.
  // The backend (Cloud Function) would then handle OCR, chunking, embedding, and updating Firestore.

  const newDocument: DocumentMetadata = {
    id: `doc${Date.now()}`,
    name: file.name,
    status: 'uploaded', // Initially 'uploaded', backend function would change to 'processing', then 'processed' or 'error'
    uploadedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    storagePath: `uploads/${file.name}`, // Example path
  };
  documents.push(newDocument);

  // Simulate processing delay and update
  setTimeout(async () => {
    const docIndex = documents.findIndex(d => d.id === newDocument.id);
    if (docIndex > -1) {
      documents[docIndex].status = 'processing';
      documents[docIndex].updatedAt = new Date().toISOString();
      revalidatePath('/dashboard'); // Revalidate dashboard to show updated status
      
      // Further simulate completion
      setTimeout(async () => {
        const finalDocIndex = documents.findIndex(d => d.id === newDocument.id);
        if (finalDocIndex > -1) {
          documents[finalDocIndex].status = 'processed';
          documents[finalDocIndex].updatedAt = new Date().toISOString();
          // Simulate summary generation
          try {
            const summaryResult = await summarizeDocument({ documentText: `Simulated full text content of ${documents[finalDocIndex].name}` });
            documents[finalDocIndex].summary = summaryResult.summary;
          } catch (error) {
            console.error("Error generating summary for new document:", error);
            // continue even if summary fails
          }
          revalidatePath('/dashboard');
          revalidatePath(`/summary/${newDocument.id}`);
        }
      }, 10000); // 10 seconds to 'processed'
    }
  }, 5000); // 5 seconds to 'processing'


  revalidatePath('/dashboard');
  return { success: true, message: `${file.name} uploaded successfully. Processing started.`, document: newDocument };
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

  // Simulate RAG: Fetch relevant chunks (this would be from Vector DB)
  // For now, we'll pass a generic context or a hint based on document name.
  // In a real scenario, you'd retrieve actual chunks related to the query.
  const mockDocumentChunks = [
    `Content related to ${document.name}. Chunk 1.`,
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

  // If no pre-generated summary, try to generate one.
  // This would typically use the full text or all chunks of the document.
  try {
    const summaryResult = await summarizeDocument({ documentText: `Full text content of ${document.name}. This is a placeholder for actual document content.` });
    // Store summary back to the document object (in real app, update Firestore)
    const docIndex = documents.findIndex(d => d.id === documentId);
    if (docIndex > -1) {
      documents[docIndex].summary = summaryResult.summary;
      documents[docIndex].updatedAt = new Date().toISOString();
      revalidatePath(`/summary/${documentId}`);
      revalidatePath('/dashboard'); // If summary is shown on dashboard
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
