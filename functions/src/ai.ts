import { logger } from 'firebase-functions/v2';
import { HttpsError } from 'firebase-functions/v2/https';

// Importa os fluxos específicos do Genkit que serão executados
import { ragChatFlow } from '../../src/ai/flows/rag-chat';
import { extractSummaryFromPdfFlow } from '../../src/ai/flows/extract-summary-from-pdf';

// Definição do tipo para o histórico da conversa, para maior clareza
type ChatHistory = Array<{ role: 'user' | 'model'; content: string }>;

/**
 * Executa o fluxo de chat RAG (Retrieval-Augmented Generation).
 * Esta função é chamada pela função 'onCall' `ragChat` em index.ts.
 *
 * @param query - A pergunta enviada pelo usuário.
 * @param processId - O ID do processo/documento para contextualizar a busca.
 * @param history - O histórico da conversa para manter o contexto do diálogo.
 * @returns O resultado da execução do fluxo, que é a resposta gerada pela IA.
 */
export async function runRagChat(
  query: string,
  processId: string,
  history: ChatHistory
) {
  logger.info(
    `[${processId}] Running RAG chat flow with query: "${query}"`
  );

  try {
    // Executa o fluxo Genkit com os dados validados recebidos do index.ts
    const flowResult = await ragChatFlow.run({
      query,
      processId,
      history,
    });

    return flowResult;
  } catch (error) {
    logger.error(`[${processId}] Error executing ragChatFlow:`, error);
    // Lança um erro padronizado para o cliente frontend
    throw new HttpsError(
      'internal',
      'Ocorreu um erro ao processar sua pergunta. Tente novamente mais tarde.'
    );
  }
}

/**
 * Executa o fluxo de extração de resumo de um documento.
 * Esta função é chamada pela função 'onCall' `extractSummary` em index.ts.
 *
 * @param processId - O ID do processo/documento a ser sumarizado.
 * @returns O resultado da execução do fluxo, que é o resumo gerado.
 */
export async function runSummaryExtraction(processId: string) {
  logger.info(`[${processId}] Running summary extraction flow.`);

  try {
    // Executa o fluxo Genkit para sumarização
    const flowResult = await extractSummaryFromPdfFlow.run({
      processId,
    });

    return flowResult;
  } catch (error) {
    logger.error(
      `[${processId}] Error executing extractSummaryFromPdfFlow:`,
      error
    );
    // Lança um erro padronizado para o cliente frontend
    throw new HttpsError(
      'internal',
      'Ocorreu um erro ao gerar o resumo. Verifique se o documento foi processado corretamente.'
    );
  }
}