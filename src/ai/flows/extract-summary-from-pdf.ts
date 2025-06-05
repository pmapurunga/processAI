
'use server';
/**
 * @fileOverview Extracts the process number and a structured list of documents from a table within a PDF.
 *
 * - extractSummaryFromPdf - A function that handles the PDF extraction process.
 * - ExtractSummaryFromPdfInput - The input type for the extractSummaryFromPdf function.
 * - ExtractSummaryFromPdfOutput - The return type for the extractSummaryFromPdf function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExtractSummaryFromPdfInputSchema = z.object({
  pdfDataUri: z
    .string()
    .describe(
      'A PDF document as a data URI that must include a MIME type and use Base64 encoding. Expected format: \'data:<mimetype>;base64,<encoded_data>\'.'      
    ),
});
export type ExtractSummaryFromPdfInput = z.infer<typeof ExtractSummaryFromPdfInputSchema>;

const DocumentEntrySchema = z.object({
  id: z.string().describe('Identificador do Documento (Id) extraído da tabela de sumário.'),
  type: z.string().describe('Tipo do Documento conforme descrito na tabela de sumário.'),
  polo: z.string().describe('Polo (Ativo, Passivo, Interno ou similar) conforme descrito na tabela de sumário.'),
  signatureDate: z.string().describe('Data da Assinatura do documento conforme descrito na tabela de sumário.'),
});
export type DocumentEntry = z.infer<typeof DocumentEntrySchema>;

const ExtractSummaryFromPdfOutputSchema = z.object({
  processNumber: z.string().describe('The process number extracted from the PDF.'),
  documentTable: z.array(DocumentEntrySchema).describe('Uma lista de documentos extraídos da tabela de sumário do PDF, cada um com Id, Tipo, Polo e Data da Assinatura.'),
});
export type ExtractSummaryFromPdfOutput = z.infer<typeof ExtractSummaryFromPdfOutputSchema>;

export async function extractSummaryFromPdf(input: ExtractSummaryFromPdfInput): Promise<ExtractSummaryFromPdfOutput> {
  return extractSummaryFromPdfFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractSummaryFromPdfPrompt',
  input: {schema: ExtractSummaryFromPdfInputSchema},
  output: {schema: ExtractSummaryFromPdfOutputSchema},
  prompt: `Você é um assistente especializado em análise de documentos jurídicos. Sua tarefa é extrair informações de um sumário de processo em PDF.
  
  Do documento PDF fornecido:
  1. Extraia o 'Número do Processo'.
  2. Identifique a tabela no sumário que lista os documentos dos autos.
  3. Para CADA entrada (linha) nessa tabela que representa um documento, extraia os seguintes campos:
     - 'Identificador do Documento' (geralmente uma coluna 'Id' ou similar).
     - 'Tipo do Documento' (a descrição do documento, ex: 'Petição Inicial', 'Laudo Pericial').
     - 'Polo' (a parte relacionada ao documento, ex: 'Ativo', 'Passivo', 'Interno').
     - 'Data da Assinatura' (a data em que o documento foi assinado ou juntado).
  4. Retorne todas as informações extraídas no formato JSON especificado. Se uma informação não estiver claramente disponível para um campo de um documento, use "Não informado" ou similar.

  PDF Document: {{media url=pdfDataUri}}`,
});

const extractSummaryFromPdfFlow = ai.defineFlow(
  {
    name: 'extractSummaryFromPdfFlow',
    inputSchema: ExtractSummaryFromPdfInputSchema,
    outputSchema: ExtractSummaryFromPdfOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);

