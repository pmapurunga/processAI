'use server';
import '@/ai/genkit.config.ts';
import { getAdmin } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import {
    ChatMessage,
    DocumentMetadata
} from '@/lib/types';
import { runQueryDocumentFlow } from '../ai/flows/query-document';

// Helper function to normalize file names
const normalizeFileName = (fileName: string): string => {
    // Sanitize the file name to remove unsupported characters for GCS and URL paths
    // 1. Replace multiple spaces/underscores with a single underscore
    // 2. Remove special characters except for letters, numbers, underscores, and periods.
    // 3. Convert to lowercase
    const sanitized = fileName
        .replace(/[\s_]+/g, '_')
        .replace(/[^a-zA-Z0-9_.-]/g, '')
        .toLowerCase();
    // Ensure it doesn't start or end with a period or underscore
    return sanitized.replace(/^[_.-]+|[_.-]+$/g, '');
};


/**
 * Retrieves a document by its ID from Firestore.
 * This function is designed to be called from the server-side (e.g., in API routes or other server components).
 * @param {string} id - The ID of the document to retrieve.
 * @returns {Promise<DocumentMetadata | null>} - A promise that resolves to the document data or null if not found.
 */
export async function getDocumentById(id: string): Promise < DocumentMetadata | null > {
    console.log(`getDocumentById INVOKED for id: ${id}`);
    try {
        const admin = getAdmin();
        const db = admin.firestore();
        const docRef = db.collection('documents').doc(id);
        const docSnap = await docRef.get();

        if (docSnap.exists) {
            console.log(`[getDocumentById] Found document ${id}`);
            const data = docSnap.data();
            if (data) {
                // Manually construct the object to ensure type conformity
                const docData: DocumentMetadata = {
                    id: docSnap.id,
                    name: data.name,
                    status: data.status,
                    internalStatus: data.internalStatus,
                    uploadedAt: data.uploadedAt ? new Date(data.uploadedAt._seconds * 1000).toISOString() : new Date().toISOString(),
                    updatedAt: data.updatedAt ? new Date(data.updatedAt._seconds * 1000).toISOString() : new Date().toISOString(),
                    storagePath: data.storagePath,
                    summary: data.summary,
                    extractedText: data.extractedText,
                    userId: data.userId,
                    errorMessage: data.errorMessage,
                };
                return docData;
            }
        } else {
            console.log(`[getDocumentById] No document found with id: ${id}`);
            return null;
        }
    } catch (error) {
        console.error(`[getDocumentById] Error retrieving document ${id}:`, error);
        throw new Error('Failed to retrieve document data.');
    }
    return null;
}

/**
 * Retrieves all documents for a given user.
 * @param {string} userId - The ID of the user whose documents to retrieve.
 * @returns {Promise<DocumentMetadata[]>} - A promise that resolves to an array of document metadata.
 */
export async function getUserDocuments(userId: string): Promise < DocumentMetadata[] > {
    try {
        const admin = getAdmin();
        const db = admin.firestore();
        // The .orderBy() clause required a composite index. By removing it, we can test if the index is the source of the error.
        // We will sort the documents in the code instead.
        const documentsSnapshot = await db.collection('documents').where('userId', '==', userId).get();

        if (documentsSnapshot.empty) {
            return [];
        }

        const documents: DocumentMetadata[] = documentsSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                name: data.name,
                status: data.status,
                uploadedAt: data.uploadedAt ? new Date(data.uploadedAt._seconds * 1000).toISOString() : new Date().toISOString(),
                updatedAt: data.updatedAt ? new Date(data.updatedAt._seconds * 1000).toISOString() : new Date().toISOString(),
            };
        });
        
        // Sort documents by date descending (newest first) in the application code.
        documents.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

        return documents;
    } catch (error) {
        console.error(`Error fetching documents for user ${userId}:`, error);
        throw new Error('Failed to fetch user documents.');
    }
}

/**
 * Deletes a document from Firestore and Firebase Storage.
 * @param {string} documentId - The ID of the document to delete.
 * @returns {Promise<{success: boolean, message: string}>} - A promise that resolves to a success or error message.
 */
export async function deleteDocument(documentId: string): Promise < {
    success: boolean;message: string
} > {
    try {
        const admin = getAdmin();
        const db = admin.firestore();
        const bucket = admin.storage().bucket();
        const docRef = db.collection('documents').doc(documentId);

        const doc = await docRef.get();
        if (!doc.exists) {
            return {
                success: false,
                message: "Document not found."
            };
        }

        const data = doc.data();
        if (data && data.storagePath) {
            await bucket.file(data.storagePath).delete();
        }

        await docRef.delete();

        return {
            success: true,
            message: "Document deleted successfully."
        };
    } catch (error) {
        console.error(`Error deleting document ${documentId}:`, error);
        return {
            success: false,
            message: `Failed to delete document: ${error instanceof Error ? error.message : String(error)}`
        };
    }
}


export async function processPdfUploadLogic(
    formData: FormData,
    userId: string
): Promise < {
    success: boolean;message: string;document ? : DocumentMetadata
} > {
    const file = formData.get('pdfFile') as File | null;
    if (!file) return {
        success: false,
        message: 'No file found.'
    };

    // Use the original name for metadata, but a normalized name for storage
    const originalFileName = file.name;
    const normalizedFileName = normalizeFileName(originalFileName);

    const admin = getAdmin();
    const db = admin.firestore();
    const bucket = admin.storage().bucket();
    const docRef = db.collection('documents').doc();

    try {
        const initialDocData: DocumentMetadata = {
            id: docRef.id,
            name: originalFileName, // Keep original name for display
            status: 'queued',
            userId,
            uploadedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        await docRef.set({ ...initialDocData,
            uploadedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        });

        await db.collection('users').doc(userId).set({
            lastActivity: FieldValue.serverTimestamp()
        }, {
            merge: true
        });

        // Use the normalized file name for the storage path
        const storagePath = `uploads/${userId}/${docRef.id}/${normalizedFileName}`;
        const fileBuffer = Buffer.from(await file.arrayBuffer());

        await bucket.file(storagePath).save(fileBuffer, {
            metadata: {
                contentType: file.type,
                metadata: {
                    firebaseStorageDownloadTokens: docRef.id,
                },
            },
        });

        await docRef.update({
            status: 'uploaded',
            internalStatus: 'upload_completed',
            storagePath: storagePath,
            updatedAt: FieldValue.serverTimestamp(),
        });
        
        console.log(`[processPdfUploadLogic] Successfully uploaded ${originalFileName}`);
        const finalDoc = await getDocumentById(docRef.id);
        return {
            success: true,
            message: 'File uploaded successfully and is queued for processing.',
            document: finalDoc ? finalDoc : undefined
        };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        console.error(`[processPdfUploadLogic] Error for ${originalFileName}:`, error);

        try {
            await docRef.update({
                status: 'error',
                errorMessage: errorMessage,
                updatedAt: FieldValue.serverTimestamp(),
            });
        } catch (updateError) {
            console.error(`[processPdfUploadLogic] Failed to update document status to error for ${docRef.id}:`, updateError);
        }

        const finalDoc = await getDocumentById(docRef.id);
        return {
            success: false,
            message: errorMessage,
            document: finalDoc ? finalDoc : undefined
        };
    }
}

export async function getChatMessages(documentId: string): Promise<ChatMessage[]> {
    try {
      const admin = getAdmin();
      const db = admin.firestore();
      const messagesSnapshot = await db
        .collection('documents')
        .doc(documentId)
        .collection('messages')
        .orderBy('timestamp', 'asc')
        .get();
  
      if (messagesSnapshot.empty) {
        return [];
      }
  
      const messages: ChatMessage[] = messagesSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          content: data.text,
          role: data.role,
          timestamp: data.timestamp.toDate().getTime(),
          documentId: documentId,
        };
      });
  
      return messages;
    } catch (error) {
      console.error(`Error fetching chat messages for document ${documentId}:`, error);
      throw new Error('Failed to fetch chat messages.');
    }
}
  
export async function queryDocumentAction(documentId: string, question: string, userId: string): Promise<{ success: boolean; answer?: string; message: string; }> {
    try {
        console.log(`[queryDocumentAction] Starting query for document ${documentId}`);

        const admin = getAdmin();
        const db = admin.firestore();
        
        // Save the user's message to Firestore
        await db.collection('documents').doc(documentId).collection('messages').add({
            text: question,
            role: 'user',
            timestamp: FieldValue.serverTimestamp(),
            userId: userId,
        });

        // Run the Genkit flow to get the answer
        const { answer } = await runQueryDocumentFlow({
            documentId,
            query: question,
        });

        // Save the AI's response to Firestore
        await db.collection('documents').doc(documentId).collection('messages').add({
            text: answer,
            role: 'model',
            timestamp: FieldValue.serverTimestamp(),
        });
        
        console.log(`[queryDocumentAction] Successfully received answer for document ${documentId}`);
        return { success: true, answer, message: 'Query successful.' };
    } catch (error) {
        console.error(`[queryDocumentAction] Error querying document ${documentId}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        return { success: false, message: errorMessage };
    }
}
