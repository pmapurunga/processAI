
export interface DocumentMetadata {
  id: string;
  name: string;
  status: 'uploading' | 'extracting_text' | 'summarizing' | 'processing' | 'processed' | 'error';
  uploadedAt: string; // ISO string date
  updatedAt: string; // ISO string date
  storagePath?: string; // Path in Firebase Storage
  gcsUri?: string; // GCS URI for Document AI (e.g., gs://bucket/path/to/file)
  summary?: string;
  extractedText?: string; // Full text extracted by Document AI
  userId?: string; // If auth is implemented
  errorMessage?: string; // To store any error message during processing
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number; // Unix timestamp
