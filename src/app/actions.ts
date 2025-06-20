
'use server';

import { getAdmin } from '@/lib/firebase-admin';
import type { DocumentMetadata, ChatMessage, PersonaConfig } from '@/lib/types';
import { firestore, storage as clientStorage } from '@/lib/firebase'; // Import clientStorage for uploads
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, doc, setDoc, getDoc, getDocs, query, where, Timestamp, addDoc, orderBy, updateDoc, FieldValue } from 'firebase/firestore';

// Genkit/AI imports
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { summarizeDocument as genkitSummarizeDocument } from '@/ai/flows/summarize-document';
import { extractTextWithDocumentAI } from '@/services/document-ai-service'; // Use the GCS URI version

// Initialize Genkit with required plugins for the server environment.
// This should only be done once.
if (!genkit.isConfigured()) {
  genkit({
    plugins: [googleAI()],
  });
}


const documentsCollection = collection(firestore, 'documents');

function toJSON(docData: any): object {
  const data = { ...docData };
  for (const key in data) {
    if (data[key] instanceof Timestamp) {
      data[key] = data[key].toDate().toISOString();
    }
  }
  return data;
}


export async function getDocuments(userId: string): Promise<DocumentMetadata[]> {
  if (!userId) {
    console.error('getDocuments called without a userId.');
    return [];
  }
  console.log(`getDocuments INVOKED for userId: ${userId}`);
  try {
    const q = query(documentsCollection, where("userId", "==", userId), orderBy("uploadedAt", "desc"));
    const snapshot = await getDocs(q);
    const documents = snapshot.docs.map(doc => toJSON({ id: doc.id, ...doc.data() }) as DocumentMetadata);
    console.log(`[getDocuments] Found ${documents.length} documents for user ${userId}:`, documents);
    return documents;
  } catch (error) {
    console.error(`Error fetching documents for user ${userId}:`, error);
    return [];
  }
}

export async function getDocumentById(id: string): Promise<DocumentMetadata | undefined> {
  console.log(`getDocumentById INVOKED for id: ${id}`);
  try {
    const docRef = doc(documentsCollection, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const document = toJSON({ id: docSnap.id, ...docSnap.data() }) as DocumentMetadata;
      console.log(`[getDocumentById] Found document ${id}:`, document);
      return document;
    }
    console.log(`[getDocumentById] Document ${id} not found.`);
    return undefined;
  } catch (error) {
    console.error(`Error fetching document ${id} from Firestore:`, error);
    return undefined;
  }
}

export async function getChatMessages(documentId: string): Promise<ChatMessage[]> {
  try {
    const messagesCollectionRef = collection(firestore, 'documents', documentId, 'messages');
    const q = query(messagesCollectionRef, orderBy("timestamp", "asc"));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
        return [{
            id: `initial-${Date.now()}`,
            documentId: documentId,
            role: 'assistant',
            content: "Hello! I am ready to answer your questions about this document. What would you like to know?",
            timestamp: Date.now(),
        }];
    }
    
    return snapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data();
        return {
            id: docSnapshot.id,
            documentId: data.documentId,
            role: data.role,
            content: data.content,
            timestamp: (data.timestamp instanceof Timestamp ? data.timestamp.toMillis() : data.timestamp),
        };
    });
  } catch (error) {
      console.error(`Error fetching chat messages for document ${documentId}:`, error);
      return [{
        id: `error-${Date.now()}`,
        documentId: documentId,
        role: 'assistant',
        content: "Sorry, I couldn't load the previous messages. Please try again.",
        timestamp: Date.now(),
    }];
  }
}

export async function queryDocumentAction(params: { documentId: string; query: string }): Promise<ChatMessage> {
    const { documentId, query: userQuery } = params;

    const userMessageData = {
        documentId,
        role: 'user' as const,
        content: userQuery,
        timestamp: Timestamp.now(), // Use Firestore Timestamp for consistency
    };

    const messagesCollectionRef = collection(firestore, 'documents', documentId, 'messages');
    // Store user message first
    const userMessageRef = await addDoc(messagesCollectionRef, userMessageData);

    // Dynamically import the flow to avoid Next.js build issues if not already done
    const { queryDocumentFlow } = await import('@/ai/flows/query-document');
    
    let aiContent: string;
    try {
        const result = await queryDocumentFlow({ documentId, query: userQuery });
        aiContent = result.answer;
    } catch (flowError) {
        console.error(`Error in queryDocumentFlow for document ${documentId}:`, flowError);
        aiContent = "I encountered an issue trying to process your request. Please try again later.";
    }
    
    const aiMessageData = {
        documentId,
        role: 'assistant' as const,
        content: aiContent,
        timestamp: Timestamp.now(), // Use Firestore Timestamp
    };
    
    const aiMessageRef = await addDoc(messagesCollectionRef, aiMessageData);

    return { 
      ...aiMessageData, 
      id: aiMessageRef.id,
      timestamp: aiMessageData.timestamp.toMillis() // Convert to number for client
    };
}

export async function getDocumentSummary(documentId: string): Promise<string | null> {
  console.log(`getDocumentSummary INVOKED for id: ${documentId}`);
  const document = await getDocumentById(documentId);
  if (document && document.status === 'processed') {
    console.log(`[getDocumentSummary] Returning summary for ${documentId}: ${document.summary?.substring(0,100)}...`);
    return document.summary || null;
  }
  if (document) {
    console.log(`[getDocumentSummary] Document ${documentId} not processed yet. Status: ${document.status}`);
  } else {
    console.log(`[getDocumentSummary] Document ${documentId} not found for summary.`);
  }
  return null;
}

const DEFAULT_PERSONA: PersonaConfig = {
  description: 'You are a helpful assistant that analyzes documents. You are concise and to the point.',
  updatedAt: new Date(0).toISOString(), // Epoch time as a sensible default
};

// Persona configuration in Firestore
const personaCollection = collection(firestore, 'personas');
const personaDocRef = doc(personaCollection, 'default');


export async function getAiPersona(): Promise<PersonaConfig> {
  try {
    const docSnap = await getDoc(personaDocRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      // Ensure updatedAt is a string, converting from Timestamp if necessary
      const updatedAt = data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt;
      return { description: data.description, updatedAt };
    } else {
      // Persona not found, create a default one
      await setDoc(personaDocRef, {
        description: DEFAULT_PERSONA.description,
        updatedAt: Timestamp.fromDate(new Date(DEFAULT_PERSONA.updatedAt)),
      });
      return DEFAULT_PERSONA;
    }
  } catch (error) {
    console.error("Error fetching or creating AI persona:", error);
    return DEFAULT_PERSONA; // Return default on error
  }
}

export async function updateAiPersonaConfig(description: string): Promise<{ success: boolean; message: string; persona?: PersonaConfig }> {
  try {
    const newUpdatedAt = Timestamp.now();
    await setDoc(personaDocRef, { description, updatedAt: newUpdatedAt }, { merge: true });
    const updatedPersona = { description, updatedAt: newUpdatedAt.toDate().toISOString() };
    return { success: true, message: "AI Persona updated successfully.", persona: updatedPersona };
  } catch (error) {
    console.error("Error updating AI persona:", error);
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    return { success: false, message: `Failed to update AI Persona: ${message}` };
  }
}


// Logic for processing PDF uploads, now accepting userId
export async function processPdfUploadLogic(
  formData: FormData,
  userId: string // Accept real userId
): Promise<{ success: boolean; message: string; document?: DocumentMetadata }> {
  console.log(`[processPdfUploadLogic] INVOKED for userId: ${userId}`);
  const file = formData.get('pdfFile') as File | null;

  if (!file) {
    return { success: false, message: 'No file found in FormData.' };
  }
  if (file.type !== 'application/pdf') {
    return { success: false, message: 'Invalid file type. Only PDF is allowed.' };
  }

  console.log(`[processPdfUploadLogic] File Name: ${file.name}, File Size: ${file.size}, File Type: ${file.type}`);

  const newDocumentId = `doc-${Date.now()}`;
  const docRef = doc(documentsCollection, newDocumentId);

  try {
    const initialDocData: DocumentMetadata = {
      id: newDocumentId,
      name: file.name,
      status: 'queued',
      internalStatus: 'upload_queued',
      uploadedAt: Timestamp.now().toDate().toISOString(),
      updatedAt: Timestamp.now().toDate().toISOString(),
      userId: userId, // Use the real userId
    };
    await setDoc(docRef, {
      ...initialDocData,
      uploadedAt: Timestamp.fromDate(new Date(initialDocData.uploadedAt)), // Store as Firestore Timestamp
      updatedAt: Timestamp.fromDate(new Date(initialDocData.updatedAt)),   // Store as Firestore Timestamp
    });
    console.log(`[processPdfUploadLogic] Initial document entry created in Firestore with id: ${newDocumentId} for user ${userId}`);

    // Path in Firebase Storage, now includes the real userId
    const storagePath = `pendingAnalysis/${userId}/${newDocumentId}/${file.name}`;
    const fileStorageRef = ref(clientStorage, storagePath);

    console.log(`[processPdfUploadLogic] Attempting to upload ${file.name} to Firebase Storage: ${storagePath}`);
    await uploadBytes(fileStorageRef, file);
    const gcsUri = `gs://${clientStorage.app.options.storageBucket}/${storagePath}`;
    console.log(`[processPdfUploadLogic] File ${file.name} uploaded to ${storagePath}. GCS URI for Document AI: ${gcsUri}.`);
    
    await updateDoc(docRef, {
      status: 'processing',
      internalStatus: 'upload_completed',
      storagePath: gcsUri, // Store the GCS URI
      updatedAt: Timestamp.now(),
    });
    console.log("[processPdfUploadLogic] Document status updated to 'processing' in Firestore.");

    // Call Document AI (using GCS URI approach)
    console.log(`[processPdfUploadLogic] Calling Document AI to extract text from ${gcsUri}`);
    const extractedText = await extractTextWithDocumentAI(gcsUri, file.type);

    if (!extractedText.trim()) {
      console.warn(`[processPdfUploadLogic] Document AI extracted no text for ${file.name}.`);
      await updateDoc(docRef, {
        status: 'error',
        internalStatus: 'result_handling_failed',
        errorMessage: 'Document AI extracted no text. The document might be empty or image-based without OCR.',
        extractedText: '',
        updatedAt: Timestamp.now(),
      });
      return {
        success: false,
        message: `Processing failed for '${file.name}': Document AI extracted no text. The document might be empty or image-based without OCR.`,
        document: { ...initialDocData, id: newDocumentId, status: 'error', errorMessage: 'Document AI extracted no text.' },
      };
    }
    console.log(`[processPdfUploadLogic] Text extracted successfully for ${file.name}. Length: ${extractedText.length}`);
    await updateDoc(docRef, {
      internalStatus: 'summarization_started',
      extractedText: extractedText,
      updatedAt: Timestamp.now(),
    });

    // Summarize document
    console.log(`[processPdfUploadLogic] Summarizing document: ${file.name}`);
    const { summary } = await genkitSummarizeDocument({ documentText: extractedText });
    console.log(`[processPdfUploadLogic] Summary generated for ${file.name}.`);

    await updateDoc(docRef, {
      status: 'processed',
      internalStatus: 'completed',
      summary: summary || "Could not generate a summary.",
      updatedAt: Timestamp.now(),
      errorMessage: FieldValue.delete(), // Clear any previous error message
    });

    console.log(`[processPdfUploadLogic] Document ${newDocumentId} processed successfully.`);
    return {
      success: true,
      message: `'${file.name}' uploaded and processing initiated. Summary will be available shortly.`,
      document: { ...initialDocData, id: newDocumentId, status: 'processed', summary: summary },
    };

  } catch (error: any) {
    console.error(`[processPdfUploadLogic] Error during processing for ${file.name}:`, error);
    const errorMessage = error.code && error.message 
      ? `Firebase Storage Error (${error.code}): ${error.message}`
      : error instanceof Error ? error.message : 'Unknown processing error';
    
    console.log(`[processPdfUploadLogic] Detailed error for frontend: ${errorMessage}`);
    
    // Update Firestore with error status
    await updateDoc(docRef, {
      status: 'error',
      internalStatus: 'result_handling_failed', // More generic error state if it's not specifically a Document AI or summarization error
      errorMessage: errorMessage,
      updatedAt: Timestamp.now(),
    }).catch(fsError => console.error(`[processPdfUploadLogic] Failed to update Firestore with error status for ${newDocumentId}:`, fsError));

    return {
      success: false,
      message: `Processing failed for '${file.name}': ${errorMessage}`,
      document: { ...(await getDocumentById(newDocumentId) || { id: newDocumentId, name: file.name, status: 'error', uploadedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), userId: userId }), errorMessage: errorMessage},
    };
  }
}
