
export interface DocumentMetadata {
  id: string;
  name: string;
  // USER-FACING STATUS: Simplified for the UI
  status: 'queued' | 'processing' | 'processed' | 'error';
  // INTERNAL STATUS: Detailed state for debugging and background processes
  internalStatus?: 'upload_queued' | 'upload_completed' | 'batch_document_ai_started' | 'parsing_document_ai_result' | 'chunking_and_embedding' | 'summarization_started' | 'completed' | 'batch_document_ai_failed' | 'result_handling_failed';
  uploadedAt: string; // ISO string date
  updatedAt: string; // ISO string date
  storagePath?: string; // Path in Firebase Storage
  summary?: string;
  extractedText?: string; // Full text extracted by Document AI
  userId?: string; 
  errorMessage?: string; // To store any error message during processing
  toJSON?: () => object;
}

export interface DocumentChunk {
  documentId: string;
  chunkId: string;
  text: string;
  // Embeddings will be stored in a separate subcollection or a dedicated vector database.
  // For simplicity in this type definition, we won't include the vector itself.
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number; // Unix timestamp
  documentId: string;
}

export interface PersonaConfig {
  description: string;
  updatedAt: string; // ISO string date for when the persona was last updated
}
