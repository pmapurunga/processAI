export interface DocumentMetadata {
  id: string;
  name: string;
  status: 'uploaded' | 'processing' | 'processed' | 'error';
  uploadedAt: string; // ISO string date
  updatedAt: string; // ISO string date
  storagePath?: string;
  summary?: string; 
  userId?: string; // If auth is implemented
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
  updatedAt: string; // ISO string date
}
