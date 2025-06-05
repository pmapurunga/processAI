
import type { Timestamp } from 'firebase/firestore'; // Import Timestamp

export interface DocumentEntryInSummary {
  id: string;
  type: string;
  polo: string;
  signatureDate: string;
}

export interface ProcessSummaryData {
  processNumber: string;
  documentTable: DocumentEntryInSummary[];
}

export interface Process {
  id: string; 
  processNumber: string; 
  summaryText?: string; // Tornando opcional, pois o foco agora é summaryJson
  summaryJson?: ProcessSummaryData | any; // Para armazenar a estrutura extraída
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
