
import * as dotenv from "dotenv";
dotenv.config(); // Carrega variáveis de .env para o ambiente, útil para teste local

import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { initializeApp, getApps, App as AdminApp } from "firebase-admin/app";
import { getFirestore, Timestamp as AdminTimestamp } from "firebase-admin/firestore"; // Import AdminTimestamp
import { getStorage as getAdminStorage } from "firebase-admin/storage"; // Import getAdminStorage
import { onObjectFinalized, StorageEvent } from "firebase-functions/v2/storage";
import { DocumentProcessorServiceClient as DocumentAIClient } from "@google-cloud/documentai";
import { genkit,اي, generate, configureGenkit } from "genkit"; // Import 'ai' directly
import { googleAI } from "@genkit-ai/googleai";
import { z } from "genkit/zod"; // Import Zod from genkit

// Inicialização do Firebase Admin SDK (apenas uma vez)
if (!getApps().length) {
  initializeApp();
}
const db = getFirestore();
const adminStorage = getAdminStorage(); // Use a instância de storage do Admin SDK

// Configuração do Genkit (local para esta Cloud Function)
// As credenciais da conta de serviço da Cloud Function devem ser usadas automaticamente pelo googleAI()
configureGenkit({
  plugins: [googleAI()],
  logLevel: "debug",
  enableTracingAndMetrics: true,
});

// Constantes para Document AI (devem ser configuradas como variáveis de ambiente na Cloud Function)
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || "processai-v9qza"; // Fallback para o novo ID
const LOCATION = process.env.DOCUMENT_AI_LOCATION; // ex: "us"
const PROCESSOR_ID = process.env.DOCUMENT_AI_PROCESSOR_ID; // Seu ID de processador

// Definição do Flow Genkit para análise de texto (diretamente aqui para simplicidade)
const AnalyzeTextContentInputSchemaLocal = z.object({
  textContent: z.string().describe("The full text content extracted from a document."),
  customAnalysisPrompt: z.string().describe("A user-defined prompt to guide the AI analysis."),
});
type AnalyzeTextContentInputLocal = z.infer<typeof AnalyzeTextContentInputSchemaLocal>;

const AnalyzeTextContentOutputSchemaLocal = z.object({
  analysisJsonString: z.string().describe("A JSON string representing the structured analysis."),
});
type AnalyzeTextContentOutputLocal = z.infer<typeof AnalyzeTextContentOutputSchemaLocal>;

const analyzeTextContentFlowLocal = اي.defineFlow( // Use 'اي'
  {
    name: "analyzeTextContentFlowInFunction",
    inputSchema: AnalyzeTextContentInputSchemaLocal,
    outputSchema: AnalyzeTextContentOutputSchemaLocal,
  },
  async (input) => {
    const { customAnalysisPrompt, textContent } = input;
    const llmResponse = await generate({ // Use generate direto
      model: googleAI.getModel("gemini-1.5-pro-latest"), // ou outro modelo Gemini
      prompt: `${customAnalysisPrompt}\n\nAnalise o seguinte texto:\n\n${textContent}\n\nRetorne a análise SOMENTE como uma string JSON válida.`,
      output: {
        format: "json", // Solicita saída JSON se o modelo suportar explicitamente
        schema: AnalyzeTextContentOutputSchemaLocal, // Ajuda a guiar o modelo
      },
      config: {
        temperature: 0.3, // Ajuste conforme necessário
         safetySettings: [ // Adicionado safetySettings como exemplo
          {
            category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
            threshold: 'BLOCK_ONLY_HIGH',
          },
        ],
      },
    });

    const analysisJsonString = llmResponse.output?.analysisJsonString || JSON.stringify({ error: "No analysis content generated or output format issue." });

    // Validação básica se é uma string JSON (pode ser mais robusta)
    try {
      JSON.parse(analysisJsonString);
    } catch (e) {
      logger.error("Generated analysis is not valid JSON:", analysisJsonString, e);
      return { analysisJsonString: JSON.stringify({ error: "Generated analysis was not valid JSON.", details: analysisJsonString }) };
    }
    return { analysisJsonString };
  }
);


export const processUploadedDocumentForAnalysis = onObjectFinalized(
  { timeoutSeconds: 540, memory: "1GiB" }, // Aumentar timeout e memória
  async (event: StorageEvent): Promise<null> => {
    logger.info("Function triggered by Storage event:", event.id);

    if (!LOCATION || !PROCESSOR_ID) {
      logger.error("Missing Document AI environment variables: DOCUMENT_AI_LOCATION or DOCUMENT_AI_PROCESSOR_ID");
      return null;
    }

    const fileBucket = event.data.bucket;
    const filePath = event.data.name;
    const contentType = event.data.contentType;
    const customMetadata = event.data.metadata;

    if (!filePath || !contentType) {
      logger.warn("File path or content type missing.", { filePath, contentType });
      return null;
    }
    logger.info(`New file: ${filePath} in ${fileBucket}`);

    if (!filePath.startsWith("pendingAnalysis/")) {
      logger.log("File is not in pendingAnalysis/, ignoring.");
      return null;
    }
    if (!contentType.includes("pdf")) {
      logger.warn(`File ${filePath} is not PDF. Type: ${contentType}.`);
      // Considerar deletar o arquivo não PDF do Storage
      // await adminStorage.bucket(fileBucket).file(filePath).delete();
      return null;
    }

    const processId = customMetadata?.processId;
    const analysisPromptUsed = customMetadata?.analysisPromptUsed;
    const userId = customMetadata?.userId;
    const originalFileName = customMetadata?.originalFileName ?? filePath.split("/").pop() ?? "unknown.pdf";

    if (!processId || !analysisPromptUsed || !userId) {
      logger.error("Essential metadata missing (processId, analysisPromptUsed, or userId):", { filePath, customMetadata });
      try {
        await adminStorage.bucket(fileBucket).file(filePath).delete();
        logger.log(`Deleted ${filePath} due to missing metadata.`);
      } catch (deleteError) {
        logger.error(`Error deleting ${filePath} (missing metadata):`, deleteError);
      }
      return null;
    }

    logger.info(`Starting processing for ${originalFileName}, process ID: ${processId}`);
    let extractedText = "";

    try {
      const bucket = adminStorage.bucket(fileBucket);
      const file = bucket.file(filePath);
      const [pdfContents] = await file.download();
      logger.info(`Successfully downloaded ${originalFileName} from Storage.`);

      const documentAIClient = new DocumentAIClient({ apiEndpoint: `${LOCATION}-documentai.googleapis.com` });
      const name = `projects/${PROJECT_ID}/locations/${LOCATION}/processors/${PROCESSOR_ID}`;

      logger.info(`Sending ${originalFileName} to Document AI processor: ${name}`);
      const [docAiResult] = await documentAIClient.processDocument({
        name,
        rawDocument: {
          content: pdfContents,
          mimeType: contentType,
        },
      });

      if (docAiResult.document?.text) {
        extractedText = docAiResult.document.text;
        logger.info(`Successfully extracted text from ${originalFileName} using Document AI. Length: ${extractedText.length}`);
      } else {
        logger.warn(`Document AI did not return text for ${originalFileName}.`);
        extractedText = ""; // Garante que não é nulo/undefined
      }
    } catch (docError) {
      logger.error(`Error during Document AI processing for ${originalFileName}:`, docError);
      // Salvar um erro na análise do Firestore
      try {
        await db.collection("processes").doc(processId).collection("documentAnalyses").add({
          processId,
          fileName: originalFileName,
          analysisPromptUsed,
          status: "error" as const,
          errorMessage: `Document AI processing failed: ${docError instanceof Error ? docError.message : String(docError)}`,
          uploadedAt: AdminTimestamp.now(), // Use AdminTimestamp
          analyzedAt: AdminTimestamp.now(),
          processedBy: "cloudFunctionError_DocAI",
        });
        await adminStorage.bucket(fileBucket).file(filePath).delete(); // Limpa o arquivo após falha
      } catch (saveError) {
        logger.error(`Failed to save DocAI error status for ${originalFileName}:`, saveError);
      }
      return null;
    }

    let analysisResultJson: any = { error: "Analysis not performed or failed before Genkit." };

    if (extractedText.trim() === "") {
      logger.warn(`No text extracted from ${originalFileName}. Using a default error message for analysisResultJson.`);
      analysisResultJson = {
        IdDocOriginal: originalFileName.split(".")[0] ?? "mockId",
        TipoDocOriginal: "Doc (Determinar tipo)",
        PoloInferido: "N/A (Sem Texto)",
        NomeArqOriginal: originalFileName,
        ResumoGeralConteudoArquivo: "Não foi possível extrair texto do documento para análise.",
        InformacoesProcessuaisRelevantes: "N/A",
        DocumentosMedicosEncontradosNesteArquivo: [],
        error: "No text content to analyze.",
      };
    } else {
      try {
        logger.info(`Invoking Genkit flow for ${originalFileName} with prompt: "${analysisPromptUsed}"`);
        const genkitInput: AnalyzeTextContentInputLocal = {
          textContent: extractedText,
          customAnalysisPrompt: analysisPromptUsed,
        };
        const genkitOutput = await analyzeTextContentFlowLocal(genkitInput);
        
        // Tenta parsear a string JSON retornada pelo Genkit
        try {
            analysisResultJson = JSON.parse(genkitOutput.analysisJsonString);
            logger.info(`Successfully received and parsed analysis from Genkit for ${originalFileName}.`);
        } catch (parseError) {
            logger.error(`Failed to parse JSON from Genkit output for ${originalFileName}:`, parseError, "Raw output:", genkitOutput.analysisJsonString);
            analysisResultJson = { 
                error: "Failed to parse JSON from AI analysis.", 
                rawOutput: genkitOutput.analysisJsonString 
            };
        }

      } catch (genkitError) {
        logger.error(`Error during Genkit analysis for ${originalFileName}:`, genkitError);
        analysisResultJson = {
          error: `Genkit analysis failed: ${genkitError instanceof Error ? genkitError.message : String(genkitError)}`,
        };
        // Salvar um erro na análise do Firestore para Genkit
        try {
          await db.collection("processes").doc(processId).collection("documentAnalyses").add({
            processId,
            fileName: originalFileName,
            analysisPromptUsed,
            status: "error" as const,
            analysisResultJson, // Salva o objeto de erro do Genkit
            errorMessage: `Genkit analysis failed: ${genkitError instanceof Error ? genkitError.message : String(genkitError)}`,
            uploadedAt: AdminTimestamp.now(),
            analyzedAt: AdminTimestamp.now(),
            processedBy: "cloudFunctionError_Genkit",
          });
          // Não deletar o arquivo aqui, pois o DocAI pode ter funcionado
        } catch (saveError) {
          logger.error(`Failed to save Genkit error status for ${originalFileName}:`, saveError);
        }
        // Decidir se retorna null ou continua para atualizar o status do processo pai
        // Por ora, vamos retornar null se o Genkit falhar criticamente.
        // return null; // Comentado para permitir que o arquivo seja limpo e o processo atualizado
      }
    }
    
    // Salvar a análise (bem-sucedida ou com erro interno do Genkit)
    try {
      const analysisEntry = {
        processId,
        fileName: originalFileName,
        analysisPromptUsed,
        analysisResultJson, // Este é o objeto parseado ou o objeto de erro
        status: analysisResultJson.error ? "error" : "completed" as const, // Define status baseado no resultado
        errorMessage: analysisResultJson.error || undefined,
        uploadedAt: AdminTimestamp.now(),
        analyzedAt: AdminTimestamp.now(),
        processedBy: "cloudFunction",
      };

      await db.collection("processes").doc(processId).collection("documentAnalyses").add(analysisEntry);
      logger.info(`Analysis for ${originalFileName} (status: ${analysisEntry.status}) saved to Firestore for process ${processId}.`);

      // Atualizar o status do processo pai, mesmo se algumas análises tiverem erro interno
      await db.collection("processes").doc(processId).set(
        { id: processId, status: "documents_completed", updatedAt: AdminTimestamp.now() },
        { merge: true }
      );
      logger.info(`Process ${processId} status updated to documents_completed.`);

    } catch (saveError) {
      logger.error(`Error saving final analysis for ${originalFileName} to Firestore:`, saveError);
      return null; // Falha crítica ao salvar no DB
    }

    // Deletar o arquivo do Storage após processamento bem-sucedido (ou erro tratado e registrado)
    try {
      await adminStorage.bucket(fileBucket).file(filePath).delete();
      logger.info(`Processed and deleted ${filePath} from Storage.`);
    } catch (deleteError) {
      logger.error(`Error deleting ${filePath} from Storage after processing:`, deleteError);
    }

    return null;
  }
);
