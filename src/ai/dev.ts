
import { config } from 'dotenv';
config();

import '@/ai/flows/analyze-document-batch.ts';
import '@/ai/flows/consolidate-analysis-chat.ts';
import '@/ai/flows/extract-summary-from-pdf.ts';
import '@/ai/flows/analyze-text-content.ts'; // Added new flow
