// Adicione esta linha no TOPO do arquivo para garantir que os tipos globais do Node.js sejam carregados
/// <reference types="node" />

// Remova ou comente esta linha se não estiver usando dotenv para carregar secrets locais para funções
// import * as dotenv from "dotenv";
// dotenv.config();

import * as functions from "firebase-functions";
import * as logger from "firebase-functions/logger";
import * as functionsV1 from "firebase-functions/v1";
import { onDocumentCreated } from "firebase-functions/v2/firestore";

import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp as AdminTimestamp } from "firebase-admin/firestore";
import { Storage } from "@google-cloud/storage";

import { DocumentProcessorServiceClient as DocumentAIClient } from "@google-cloud/documentai";

// Removida a importação de `googleAI` - não é usada diretamente aqui
import { embed } from "@genkit-ai/ai";

import busboy, { FileInfo } from "busboy";

// Inicialização do Firebase Admin SDK
if (!getApps().length) {
  initializeApp();
}
const db = getFirestore();
const storage = new Storage(); // A instância 'storage' será usada abaixo

// Constantes
// Acesso às variáveis de configuração do Firebase Functions
const PROJECT_ID = functions.config().google_cloud.project_id;
const LOCATION = functions.config().documentai.location;
const PROCESSOR_ID = functions.config().documentai.processor_id;
const FIREBASE_STORAGE_BUCKET = functions.config().app.storage_bucket;


// Parte 1: Função HTTP para receber o PDF e extrair texto
export const processPdfEndpoint = functionsV1
  .runWith({ timeoutSeconds: 540, memory: "1GB" })
  .https.onRequest(async (req, res) => {
    if (req.method !== "POST") {
      logger.warn("Method Not Allowed", { method: req.method });
      res.status(405).send("Method Not Allowed");
      return;
    }
    // Melhorar a verificação de variáveis de ambiente no runtime para ser mais robusta
    if (!PROJECT_ID || !LOCATION || !PROCESSOR_ID || !FIREBASE_STORAGE_BUCKET) {
      logger.error("Missing required environment variables:", {
        PROJECT_ID: PROJECT_ID,
        LOCATION: LOCATION,
        PROCESSOR_ID: PROCESSOR_ID,
        FIREBASE_STORAGE_BUCKET: FIREBASE_STORAGE_BUCKET,
      });
      res.status(500).send({ success: false, error: "Server configuration error. Missing environment variables." });
      return;
    }

    const bb = busboy({ headers: req.headers });
    let fileBuffer: Buffer | undefined;
    let fileName: string | undefined;
    let mimeType: string | undefined;
    let processId: string | undefined;

    bb.on("field", (fieldname: string, val: string) => {
      if (fieldname === "processId") {
        processId = val;
      }
    });

    bb.on("file", (_fieldname: string, file: NodeJS.ReadableStream, info: FileInfo) => {
      const { filename, mimeType: fileMimeType } = info;
      logger.info(`File received: ${filename} with mimeType: ${fileMimeType}`);
      if (!fileMimeType.includes("pdf") && !fileMimeType.includes("tiff")) {
        logger.warn(`Unsupported file type received: ${fileMimeType}. Skipping.`);
        file.resume();
        return;
      }
      fileName = filename;
      mimeType = fileMimeType;
      const chunks: Buffer[] = [];
      file.on("data", (chunk: Buffer) => chunks.push(chunk));
      file.on("end", () => fileBuffer = Buffer.concat(chunks));
    });

    bb.on("finish", async () => {
      if (!fileBuffer || !fileName || !mimeType || !processId) {
        logger.error("File upload incomplete or missing processId.");
        res.status(400).send({ success: false, error: "File or processId missing." });
        return;
      }

      try {
        // Salvar o arquivo no Firebase Storage ANTES de processar com Document AI
        const bucket = storage.bucket(FIREBASE_STORAGE_BUCKET); // Usa a variável de bucket
        const filePath = `uploads/${processId}/${fileName}`;
        const fileRef = bucket.file(filePath);

        await fileRef.save(fileBuffer, {
          contentType: mimeType,
        });
        logger.info(`Arquivo ${fileName} carregado para ${filePath} no Storage.`);


        const documentAIClient = new DocumentAIClient({ apiEndpoint: `${LOCATION}-documentai.googleapis.com` });
        const name = `projects/${PROJECT_ID}/locations/${LOCATION}/processors/${PROCESSOR_ID}`;

        logger.info(`Sending file ${fileName} to Document AI processor: ${name}`);

        const [docAiResult] = await documentAIClient.processDocument({
          name,
          rawDocument: { content: fileBuffer, mimeType: mimeType },
        });

        const extractedText = docAiResult.document?.text || "";
        logger.info(`Extracted text from ${fileName}. Length: ${extractedText.length}`);

        // Salvar o texto extraído no Firestore
        const docRef = db.collection("processes").doc(processId).collection("extracted_texts").doc();
        await docRef.set({
          processId,
          fileName,
          storagePath: filePath, // Adiciona o caminho do storage
          extractedAt: AdminTimestamp.now(),
          textLength: extractedText.length,
          textContent: extractedText,
          status: "extracted",
        });

        logger.info(`Extracted text from ${fileName} saved to Firestore with ID: ${docRef.id}`);
        res.status(200).send({
          success: true,
          message: "PDF processed successfully and text extracted.",
          documentId: docRef.id,
        });
        return;
      } catch (error) {
        logger.error(`Error processing file ${fileName} with Document AI:`, error);
        res.status(500).send({ success: false, error: "Failed to process file with Document AI." });
        return;
      }
    });

    req.pipe(bb);
  });


// Parte 2: Função acionada pelo Firestore para gerar embeddings
function splitTextIntoChunks(text: string, chunkSize: number, chunkOverlap: number): string[] {
  if (chunkOverlap >= chunkSize) {
    logger.error("chunkOverlap must be smaller than chunkSize. Adjusting chunkOverlap to 0.");
    chunkOverlap = 0;
  }
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    const end = Math.min(i + chunkSize, text.length);
    chunks.push(text.slice(i, end));
    i += chunkSize - chunkOverlap;
  }
  return chunks;
}

export const generateEmbeddingsForText = onDocumentCreated(
  { document: "processes/{processId}/extracted_texts/{textDocId}", memory: "1GB", timeoutSeconds: 540 },
  async (event) => {
    const snap = event.data;
    if (!snap) {
      logger.error("[Embeddings] No data associated with the event.");
      return;
    }
    const { textContent, processId, fileName } = snap.data() as
      { textContent: string, processId: string, fileName: string };
    if (!textContent || !processId || !fileName) {
      logger.error("[Embeddings] Document data is missing required fields for embedding.");
      await snap.ref.update({ status: "error_missing_data_for_embedding" });
      return;
    }

    try {
      const chunks = splitTextIntoChunks(textContent, 700, 100);
      logger.info(`[Embeddings] Text from "${fileName}" split into ${chunks.length} chunks.`);

      const embeddingResults = await embed({
        model: "googleai/text-embedding-004",
        content: chunks.map(chunk => ({ text: chunk })),
      });

      if (embeddingResults.length !== chunks.length) {
        throw new Error("Mismatch between chunks and embeddings count.");
      }

      const batch = db.batch();
      for (let i = 0; i < chunks.length; i++) {
        const chunkDocRef = db.collection("processes").doc(processId).collection("text_chunks").doc();
        batch.set(chunkDocRef, {
          processId,
          originalDocId: snap.id,
          originalFileName: fileName,
          chunkNumber: i + 1,
          totalChunks: chunks.length,
          chunkText: chunks[i],
          embedding: embeddingResults[i].embedding,
          createdAt: AdminTimestamp.now(),
        });
      }

      await batch.commit();
      logger.info(`[Embeddings] Successfully saved ${chunks.length} chunks with embeddings for "${fileName}".`);
      await snap.ref.update({ status: "embeddings_generated" });
    } catch (error) {
      logger.error(`[Embeddings] Failed to generate embeddings for "${fileName}".`, error);
      await snap.ref.update({
        status: "error_generating_embeddings",
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  },
);
// Adicione uma nova linha vazia aqui