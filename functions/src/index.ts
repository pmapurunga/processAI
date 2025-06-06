
import * as functions from "firebase-functions";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";

// Inicializa o Firebase Admin SDK se ainda não foi inicializado.
if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();
const storageAdmin = admin.storage();

/**
 * Exemplo de função HTTP simples.
 */
export const helloWorld = functions.https.onRequest((request, response) => {
  logger.info("Hello logs!", { structuredData: true });
  response.send("Hello from Firebase Functions!");
});

/**
 * Processa um documento carregado para análise.
 * Acionado quando um novo arquivo é finalizado no Storage.
 */
export const processUploadedDocumentForAnalysis = functions.storage
  .object()
  .onFinalize(async (object) => {
    const filePath = object.name; // Caminho do arquivo no bucket.
    const contentType = object.contentType; // Tipo de conteúdo do arquivo.
    const bucketName = object.bucket; // Nome do bucket.

    if (!filePath || !contentType) {
      logger.warn("Caminho ou tipo de conteúdo ausente.", {
        filePath,
        contentType,
      });
      return null;
    }

    logger.info(`Novo arquivo: ${filePath} em ${bucketName}`);

    // Verifica se o arquivo está no diretório correto.
    // Ex: "pendingAnalysis/USER_ID/PROCESS_ID/FILENAME.pdf"
    if (!filePath.startsWith("pendingAnalysis/")) {
      logger.log("Arquivo não está em pendingAnalysis/, ignorando.");
      return null;
    }

    // Verifica se é um PDF.
    if (!contentType.includes("pdf")) {
      logger.warn(`Arquivo ${filePath} não é PDF. Tipo: ${contentType}.`);
      // Opcional: deletar arquivos não-PDF.
      // await storageAdmin.bucket(bucketName).file(filePath).delete();
      return null;
    }

    // Extrai metadados customizados.
    const customMetadata = object.metadata || {};
    const processId = customMetadata.processId;
    const analysisPrompt = customMetadata.analysisPromptUsed;
    const userId = customMetadata.userId;
    const originalName =
      customMetadata.originalFileName ||
      filePath.split("/").pop() ||
      "unknown.pdf";

    if (!processId || !analysisPrompt || !userId) {
      logger.error("Metadados ausentes para arquivo:", {
        filePath,
        customMetadata,
      });
      // Deleta o arquivo se metadados essenciais estiverem faltando.
      await storageAdmin.bucket(bucketName).file(filePath).delete();
      logger.log(`Deletado ${filePath} (metadados ausentes).`);
      return null;
    }

    logger.info(`Processando ${originalName} para proc ${processId}`);

    // TODO: Implementar lógica real de análise de IA aqui.
    // Por enquanto, usamos um resultado mockado.
    logger.info(`Simulando análise de IA para ${originalName}...`);
    const simulatedJson = {
      IdDocOriginal: originalName.split(".")[0] || "mockId",
      TipoDocOriginal: "Doc (Simulado CF)",
      PoloInferido: "Ativo (Simulado CF)",
      NomeArqOriginal: originalName,
      ResumoGeral: `Resumo simulado para ${originalName}.`,
      InfoProcessuais: "Info processual CF (simulada).",
      DocsMedicos: [
        {
          TipoDocMedico: "Atestado (Simulado CF)",
          DataDocMedico: new Date().toISOString().split("T")[0],
          Profissional: "Dr. Simulado (CF)",
          ResumoMedico: "Diag. simulado: Condição X (CF).",
          Pagina: "pg 1 (simulado)",
        },
      ],
    };

    try {
      const analysisEntry = {
        processId,
        fileName: originalName,
        analysisPromptUsed: analysisPrompt,
        analysisResultJson: simulatedJson,
        status: "completed" as const,
        uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
        analyzedAt: admin.firestore.FieldValue.serverTimestamp(),
        processedBy: "cloudFunction", // Identifica quem processou
      };

      // Salva o resultado da análise no Firestore.
      await db
        .collection("processes")
        .doc(processId)
        .collection("documentAnalyses")
        .add(analysisEntry);
      logger.info(`Análise para ${originalName} salva para ${processId}.`);

      // Atualiza o status do processo pai.
      await db
        .collection("processes")
        .doc(processId)
        .set(
          {
            status: "documents_completed", // Ou "chat_ready"
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      logger.info(`Processo ${processId} status atualizado.`);
    } catch (error) {
      logger.error(
        `Erro ao salvar análise para ${originalName} no Firestore:`,
        error,
      );
      // Não deleta o arquivo do Storage se o salvamento no Firestore falhar,
      // para permitir nova tentativa ou depuração.
      return null;
    }

    // Deleta o arquivo do Storage após processamento bem-sucedido.
    try {
      await storageAdmin.bucket(bucketName).file(filePath).delete();
      logger.info(`Processado e deletado ${filePath} do Storage.`);
    } catch (error) {
      logger.error(`Erro ao deletar ${filePath} do Storage:`, error);
      // Mesmo se a exclusão falhar, a análise foi salva.
    }

    return null;
  });

// Exemplos de outros tipos de gatilhos (comentados):

/*
// Gatilho do Firestore (ex: ao criar um novo documento)
export const myFirestoreTrigger = functions.firestore
  .document("someCollection/{docId}")
  .onCreate((snap, context) => {
    const newValue = snap.data();
    const docId = context.params.docId;
    logger.info(`Novo doc ${docId} criado:`, newValue);
    // Faça algo com os dados...
    return null;
  });
*/

/*
// Função Chamável (Callable Function)
export const myCallableFunction = functions.https.onCall((data, context) => {
  // context.auth contém informações do usuário autenticado, se houver.
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "A função deve ser chamada enquanto autenticado.",
    );
  }
  const text = data.text;
  logger.info("Dados recebidos na função chamável:", text);
  // Faça algo com os dados e retorne um resultado.
  return { result: `Recebido: ${text}` };
});
*/
