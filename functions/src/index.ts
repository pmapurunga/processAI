
import * as functions from "firebase-functions";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import type { ObjectMetadata } from "firebase-functions/v1/storage";

if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();
const storageAdmin = admin.storage();

/**
 * Exemplo de função HTTP.
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
  .onFinalize(async (object: ObjectMetadata): Promise<null> => {
    if (!object) {
      logger.warn("Objeto do evento de Storage ausente.");
      return null;
    }

    const filePath: string | undefined = object.name;
    const contentType: string | undefined = object.contentType;
    const bucketName: string = object.bucket;
    const customMetadata: Record<string, string> | undefined = object.metadata;

    if (!filePath || !contentType) {
      logger.warn("Caminho do arquivo ou tipo de conteúdo ausente.", {
        filePath,
        contentType,
      });
      return null;
    }

    logger.info(`Novo arquivo: ${filePath} em ${bucketName}`);

    if (!filePath.startsWith("pendingAnalysis/")) {
      logger.log("Arquivo não está em pendingAnalysis/, ignorando.");
      return null;
    }

    if (!contentType.includes("pdf")) {
      logger.warn(`Arquivo ${filePath} não é PDF. Tipo: ${contentType}.`);
      return null;
    }

    const processId = customMetadata?.processId;
    const analysisPrompt = customMetadata?.analysisPromptUsed;
    const userId = customMetadata?.userId;
    const originalName =
      customMetadata?.originalFileName ??
      filePath.split("/").pop() ??
      "unknown.pdf";

    if (!processId || !analysisPrompt || !userId) {
      logger.error("Metadados essenciais ausentes:", { filePath, customMetadata });
      try {
        await storageAdmin.bucket(bucketName).file(filePath).delete();
        logger.log(`Deletado ${filePath} (metadados ausentes).`);
      } catch (deleteError: unknown) {
        if (deleteError instanceof Error) {
          logger.error(
            `Erro ao deletar ${filePath} (metadados ausentes):`,
            deleteError.message,
          );
        } else {
          logger.error(
            `Erro desconhecido ao deletar ${filePath} (metadados ausentes).`,
          );
        }
      }
      return null;
    }

    logger.info(`Processando ${originalName} para processo ${processId}`);
    logger.info(`Simulando análise de IA para ${originalName}...`);

    const simulatedJson = {
      IdDocOriginal: originalName.split(".")[0] ?? "mockId",
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
        processedBy: "cloudFunction",
      };

      await db
        .collection("processes")
        .doc(processId)
        .collection("documentAnalyses")
        .add(analysisEntry);
      logger.info(`Análise para ${originalName} salva para ${processId}.`);

      await db
        .collection("processes").doc(processId)
        .set(
          {
            id: processId,
            status: "documents_completed",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      logger.info(`Processo ${processId} status atualizado.`);

    } catch (error) {
      if (error instanceof Error) {
        logger.error(
          `Erro ao salvar análise para ${originalName} no Firestore:`,
          error.message,
        );
      } else {
        logger.error(
          `Erro desconhecido ao salvar análise para ${originalName} no Firestore.`,
        );
      }
      return null;
    }

    try {
      await storageAdmin.bucket(bucketName).file(filePath).delete();
      logger.info(`Processado e deletado ${filePath} do Storage.`);
    } catch (error: unknown) {
      if (error instanceof Error) {
        logger.error(
          `Erro ao deletar ${filePath} do Storage:`, error.message,
        );
      } else {
        logger.error(
          `Erro desconhecido ao deletar ${filePath} do Storage.`,
        );
      }
    }
    return null;
  });
