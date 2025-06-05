
import type { Timestamp } from 'firebase/firestore'; // Import Timestamp

export interface Process {
  id: string; 
  processNumber: string; 
  summaryText?: string; 
  summaryJson?: any; 
  userId: string; 
  createdAt: Date | Timestamp; // Can be Date on client, Timestamp from Firestore
  updatedAt?: Date | Timestamp;
  status?: 'summary_pending' | 'summary_completed' | 'documents_pending' | 'documents_completed' | 'chat_ready' | 'archived';
}

export interface DocumentRecord {
  id: string; 
  processId: string;
  fileName: string;
  originalFileName?: string; 
  analysisPromptUsed?: string;
  analysisResultJson?: any; 
  status: 'pending' | 'analyzing' | 'completed' | 'error';
  errorMessage?: string;
  uploadedAt: Date | Timestamp; 
  analyzedAt?: Date | Timestamp; 
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date | Timestamp; 
  processId?: string; 
}
