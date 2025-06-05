
/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 * import {onObjectFinalized} from "firebase-functions/v2/storage";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import {onRequest} from "firebase-functions/v2/https";
import * as functions from "firebase-functions";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK.
if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();
const storageAdmin = admin.storage();


export const helloWorld = onRequest((request, response) => {
  logger.info("Hello logs!", {structuredData: true});
  response.send("Hello from Firebase Functions!");
});


export const processUploadedDocumentForAnalysis = functions.storage
  .object()
  .onFinalize(async (object) => {
    const filePath = object.name; // File path in the bucket.
    const contentType = object.contentType; // File content type.
    const bucketName = object.bucket;

    logger.info(
      `New file uploaded: ${filePath} in bucket ${bucketName}`,
      {contentType, metadata: object.metadata},
    );

    // Exit if this is triggered on a file that is not in the expected path
    if (!filePath || !filePath.startsWith("pendingAnalysis/")) {
      logger.log("File is not in pendingAnalysis/ path, ignoring.");
      return null;
    }

    // Exit if not a PDF (though client should ensure this)
    if (!contentType || !contentType.includes("pdf")) {
      const warningMsg = `File ${filePath} is not a PDF, content type: ` +
                         `${contentType}. Skipping analysis.`;
      logger.warn(warningMsg);
      // Optionally delete the non-PDF file
      // await storageAdmin.bucket(bucketName).file(filePath).delete();
      return null;
    }

    const customMetadata = object.metadata || {};
    const processId = customMetadata.processId;
    const analysisPromptUsed = customMetadata.analysisPromptUsed;
    const userId = customMetadata.userId;
    const originalFileName = customMetadata.originalFileName ||
                             filePath.split("/").pop() ||
                             "unknown.pdf";

    if (!processId || !analysisPromptUsed || !userId) {
      const errorMsg = "Missing required metadata (processId, " +
                       "analysisPromptUsed, or userId) for file:";
      logger.error(errorMsg, filePath, customMetadata);
      // Optionally move to an error folder or just delete
      await storageAdmin.bucket(bucketName).file(filePath).delete();
      logger.log(`Deleted ${filePath} due to missing metadata.`);
      return null;
    }

    logger.info(
      `Processing ${originalFileName} for process ${processId} ` +
      `by user ${userId}`,
    );

    // Atualmente, a Cloud Function não pode chamar diretamente a flow Genkit
    // `analyzeDocumentBatch` que está definida no código Next.js com "use server".
    // A integração da chamada real à IA Genkit aqui é um passo futuro.
    // Para agora, vamos simular a análise e salvar um resultado mockado.

    // TODO: Passo 1: Baixar o arquivo (opcional se a IA puder ler direto do
    // GCS URI, mas geralmente se baixa)
    // const fileBuffer = await storageAdmin.bucket(bucketName).file(filePath)
    //   .download();
    // const pdfDataUri = `data:${contentType};base64,` +
    //   `${fileBuffer[0].toString("base64")}`;
    // logger.info(`File ${originalFileName} downloaded, data URI created ` +
    //   `(length: ${pdfDataUri.length})`);

    // TODO: Passo 2: Chamar a IA para análise (usando pdfDataUri e
    // analysisPromptUsed)
    // Esta é a parte que precisaria de uma flow Genkit adaptada para Cloud
    // Functions ou uma chamada direta ao SDK do Google AI.
    const simulatingMsg = `Simulating AI analysis for ${originalFileName} ` +
                          `with prompt: "${analysisPromptUsed}"`;
    logger.info(simulatingMsg);
    const simulatedAnalysisResultJson = {
      "IdDocumentoOriginal": originalFileName.split(".")[0], // Mocked
      "TipoDocumentoOriginal": "Documento (Simulado pela CF)",
      "PoloInferido": "Ativo (Simulado pela CF)",
      "NomeArquivoOriginal": originalFileName,
      "ResumoGeralConteudoArquivo": `Este é um resumo simulado do conteúdo ` +
        `do arquivo ${originalFileName} gerado pela Cloud Function.`,
      "InformacoesProcessuaisRelevantes": "Nenhuma informação processual " +
        "real, pois esta é uma simulação.",
      "DocumentosMedicosEncontradosNesteArquivo": [
        {
          "TipoDocumentoMedico": "Atestado Médico (Simulado)",
          "DataDocumentoMedico": new Date().toISOString().split("T")[0],
          "ProfissionalServico": "Dr. Simulado",
          "ResumoConteudoMedico": "Diagnóstico simulado: Condição X.",
          "Pagina(s)NoOriginal": "pg 1 (simulado)",
        },
      ],
    };
    logger.info("AI analysis simulation complete.");

    // Passo 3: Salvar o resultado no Firestore
    try {
      const documentAnalysisData = {
        processId,
        fileName: originalFileName,
        analysisPromptUsed,
        analysisResultJson: simulatedAnalysisResultJson,
        status: "completed" as const,
        uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
        analyzedAt: admin.firestore.FieldValue.serverTimestamp(),
        processedBy: "cloudFunction",
      };

      await db.collection("processes").doc(processId)
        .collection("documentAnalyses").add(documentAnalysisData);
      logger.info(
        `Analysis result for ${originalFileName} saved to Firestore for ` +
        `process ${processId}.`,
      );

      // Passo 3.1: Atualizar o status do processo pai
      // Isso é uma simplificação. Pode ser necessário verificar se todas as
      // análises foram concluídas.
      await db.collection("processes").doc(processId).set({
        status: "documents_completed", // Ou "chat_ready" se for o caso
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, {merge: true});
      logger.info(`Process ${processId} status updated.`);
    } catch (error) {
      logger.error(
        `Error saving analysis for ${originalFileName} to Firestore:`,
        error,
      );
      // Não deletar o arquivo do Storage se o salvamento no Firestore falhar,
      // para permitir nova tentativa ou depuração.
      return null;
    }

    // Passo 4: Deletar o arquivo do Storage após processamento bem-sucedido
    try {
      await storageAdmin.bucket(bucketName).file(filePath).delete();
      logger.info(
        `Successfully processed and deleted ${filePath} from Storage.`,
      );
    } catch (error) {
      logger.error(`Error deleting file ${filePath} from Storage:`, error);
      // Mesmo que a deleção falhe, a análise foi salva.
    }

    return null;
  });

// Para usar Firebase Functions para processamento assíncrono, você consideraria
// gatilhos como:
//
// 1. Gatilho do Cloud Storage (onObjectFinalized):
//    (Exemplo acima implementado)
//    Útil para processar arquivos após o upload.
//
// 2. Gatilho do Firestore (onDocumentWritten, onDocumentCreated, etc.):
//    Útil para reagir a mudanças nos seus dados do Firestore.
//    Exemplo de assinatura:
//    export const processNewProcessEntry = onDocumentWritten(
//      "processes/{processId}", async (event) => {
//      if (!event.data?.after.exists) {
//        logger.info(`Process ${event.params.processId} deleted.`);
//        return;
//      }
//      const processData = event.data.after.data();
//      logger.info(`Process ${event.params.processId} written:`, processData);
//
//      // Lógica a ser executada quando um documento de processo é criado ou
//      // atualizado.
//
//      return;
//    });
//
// 3. Funções Chamáveis (onCall):
//    Permitem que seu aplicativo cliente chame diretamente uma função como se
//    fosse uma API RPC.
//    Exemplo de assinatura:
//    export const myCallableFunction = onCall((request) => {
//      // request.auth contém informações sobre o usuário autenticado, se houver.
//      // request.data contém os dados enviados pelo cliente.
//      const text = request.data.text;
//      const logMsg = `Callable function received text: ${text}, by user: ` +
//                     `${request.auth?.uid}`;
//      logger.info(logMsg);
//      return {message: `Received: ${text}`};
//    });

// Lembre-se que:
// - As Cloud Functions têm seu próprio ambiente. Se você usar Genkit dentro
//   delas, certifique-se de que as chaves de API ou a autenticação do Google
//   Cloud (via conta de serviço da função) estejam configuradas corretamente
//   para os serviços de IA que o Genkit utiliza.
// - Adicione quaisquer dependências específicas para suas funções ao
//   `functions/package.json` e execute `npm install` dentro do diretório
//   `functions/` antes de fazer o deploy.
// - As permissões da conta de serviço da função precisam permitir
//   leitura/escrita no Firestore e Storage. E permissões para a API de IA,
//   se usada.

    