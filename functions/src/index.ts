import * as admin from 'firebase-admin';
import { onObjectFinalized } from 'firebase-functions/v2/storage';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import * as path from 'path';

// Importa os inicializadores e os fluxos/handlers
import { initializeGenkit } from '../../src/ai/genkit';
import { ingestDocumentFlow } from '../../src/ai/flows/ingest-document';
import { runRagChat, runSummaryExtraction } from './ai';

// Inicializa o Firebase Admin e o Genkit uma única vez no escopo global
admin.initializeApp();
initializeGenkit();

/**
 * Gatilho do Cloud Storage que inicia o processo de ingestão de documentos.
 * Esta função é projetada para ser um gatilho leve. Sua única responsabilidade
 * é capturar o evento de criação de um novo arquivo PDF e invocar o fluxo
 * Genkit `ingestDocumentFlow`, que orquestra toda a lógica de negócio.
 */
export const ingestDocument = onObjectFinalized(
  {
    cpu: 2, // Mantém as configurações de recursos
    memory: '1GiB',
    timeoutSeconds: 1800,
  },
  async (event) => {
    const { bucket, name: filePath } = event.data;

    // Extrai o ID do processo do caminho do arquivo (ex: 'processes/{processId}/file.pdf')
    const processId = path.basename(path.dirname(filePath));

    // Validação para garantir que o arquivo é um PDF e pertence a um processo
    if (!filePath.endsWith('.pdf') || !processId) {
      logger.log(`File ${filePath} is not a valid process PDF. Skipping.`);
      return;
    }

    logger.info(`[${processId}] Triggering ingestion for: ${filePath}`);

    try {
      // Invoca o fluxo Genkit, passando a responsabilidade do processamento.
      // O fluxo agora lidará com o download, extração de texto (OCR ou direto) e embeddings.
      await ingestDocumentFlow.run({
        filePath,
        processId,
      });

      logger.info(
        `[${processId}] Successfully triggered Genkit flow for ingestion.`
      );
    } catch (error) {
      logger.error(`[${processId}] Error triggering ingestion flow:`, error);

      // Em caso de falha ao *iniciar* o fluxo, atualiza o status no Firestore.
      await admin
        .firestore()
        .collection('processes')
        .doc(processId)
        .update({
          status: 'error',
          error: 'Failed to trigger the ingestion process.',
        });
    }
  }
);

/**
 * Função chamável pelo cliente (onCall) para interação com o chat RAG.
 * Ela garante que o usuário esteja autenticado e passa a consulta
 * para o handler que executa o fluxo Genkit correspondente.
 */
export const ragChat = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError(
      'unauthenticated',
      'Você deve estar autenticado para usar o chat.'
    );
  }

  const { query, processId, history } = request.data;
  if (!query || !processId) {
    throw new HttpsError(
      'invalid-argument',
      'A função deve ser chamada com "query" e "processId".'
    );
  }

  return await runRagChat(query, processId, history || []);
});

/**
 * Função chamável pelo cliente (onCall) para solicitar a sumarização
 * de um documento.
 */
export const extractSummary = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError(
      'unauthenticated',
      'Você deve estar autenticado para solicitar um resumo.'
    );
  }

  const { processId } = request.data;
  if (!processId) {
    throw new HttpsError(
      'invalid-argument',
      'A função deve ser chamada com "processId".'
    );
  }

  return await runSummaryExtraction(processId);
});