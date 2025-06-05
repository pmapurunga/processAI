export interface Process {
  id: string; // Firestore document ID, could be same as processNumber or generated
  processNumber: string; // "Número do Processo"
  summaryText?: string; // Extracted summary text
  summaryJson?: any; // Full JSON result from extractSummaryFromPdf
  userId: string; // ID of the user who created this process
  createdAt: any; // Firestore Timestamp or Date
  updatedAt?: any; // Firestore Timestamp or Date
  status?: 'summary_pending' | 'summary_completed' | 'documents_pending' | 'documents_completed' | 'chat_ready' | 'archived';
}

export interface DocumentRecord {
  id: string; // Firestore document ID
  processId: string;
  fileName: string;
  originalFileName?: string; // If different from stored name
  analysisPromptUsed?: string;
  analysisResultJson?: any; // Full JSON from analyzeDocumentBatch
  status: 'pending' | 'analyzing' | 'completed' | 'error';
  errorMessage?: string;
  uploadedAt: any; // Firestore Timestamp or Date
  analyzedAt?: any; // Firestore Timestamp or Date
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: any; // Firestore Timestamp or Date
  processId?: string; // Link to the process if relevant
}

// For the AI flow outputs, refer to the schemas in src/ai/flows/*.ts
// For example:
// import type { ExtractSummaryFromPdfOutput } from '@/ai/flows/extract-summary-from-pdf';
// import type { AnalyzeDocumentBatchOutput } from '@/ai/flows/analyze-document-batch';
// import type { ConsolidateAnalysisChatOutput } from '@/ai/flows/consolidate-analysis-chat';
