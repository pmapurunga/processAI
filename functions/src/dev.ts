
import { config } from 'dotenv';
config();

import './flows/analyze-document-batch.js';
import './flows/extract-summary-from-pdf.js';
import './flows/analyze-text-content.js';
