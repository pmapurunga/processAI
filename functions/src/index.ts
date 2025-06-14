import * as dotenv from "dotenv";
dotenv.config();

import * as logger from "firebase-functions/logger";
import * as functionsV1 from "firebase-functions/v1"; // Import V1 para HTTP
import { onDocumentCreated } from "firebase-functions/v2/firestore"; // Import V2 para Triggers

import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp as AdminTimestamp } from "firebase-admin/firestore";
import { DocumentProcessorServiceClient as DocumentAIClient } from "@google-cloud/documentai";

// eslint-disable-next-line import/named
import { configureGenkit } from "@genkit-ai/core"; // CORREÇÃO: Desabilitar linter para esta linha
import { embed } from "@genkit-ai/ai";
import { googleAI } from "@genkit-ai/googleai";
import busboy from "busboy";

// Inicialização do Firebase Admin SDK
if (!getApps().length) {
  initializeApp();
}
const db = getFirestore();

// Inicializa o Genkit globalmente
configureGenkit({
  plugins: [googleAI()],
  logLevel: "debug",
  enableTracingAndMetrics: true,
});

// Constantes
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || "processai-v9qza";
const LOCATION = process.env.DOCUMENT_AI_LOCATION; // ex: "us"
const PROCESSOR_ID = process.env.DOCUMENT_AI_PROCESSOR_ID;


// Parte 1: Função HTTP para receber o PDF e extrair texto
export const processPdfEndpoint = functionsV1
  .runWith({ timeoutSeconds: 540, memory: "1GiB" })
  .https.onRequest(async (req: functionsV1.Request, res: functionsV1.Response) => {
    if (req.method !== "POST") {
      logger.warn("Method Not Allowed", { method: req.method });
      return res.status(405).send("Method Not Allowed");
    }
    if (!LOCATION || !PROCESSOR_ID) {
      logger.error("Missing Document AI environment variables");
      return res.status(500).send({ success: false, error: "Server configuration error." });
    }

    const bb = busboy({ headers: req.headers });
    let fileBuffer: Buffer | undefined;
    let fileName: string | undefined;
    let mimeType: string | undefined;
    let processId: string | undefined;

    bb.on("field", (fieldname, val) => {
      if (fieldname === "processId") {
        processId = val as string;
      }
    });

    bb.on("file", (_fieldname, file, info) => {
      const { filename, mimeType: fileMimeType } = info;
      logger.info(`File received: ${filename}`);
      if (!fileMimeType.includes("pdf") && !fileMimeType.includes("tiff")) {
        file.resume(); return;
      }
      fileName = filename;
      mimeType = fileMimeType;
      const chunks: Buffer[] = [];
      file.on("data", (chunk) => chunks.push(chunk));
      file.on("end", () => fileBuffer = Buffer.concat(chunks));
    });

    bb.on("finish", async () => {
      if (!fileBuffer || !fileName || !mimeType || !processId) {
        logger.error("File upload incomplete or missing processId.");
        return res.status(400).send({ success: false, error: "File or processId missing." });
      }

      try {
        const documentAIClient = new DocumentAIClient({ apiEndpoint: `${LOCATION}-documentai.googleapis.com` });
        const name = `projects/${PROJECT_ID}/locations/${LOCATION}/processors/${PROCESSOR_ID}`;
        const [docAiResult] = await documentAIClient.processDocument({
          name,
          rawDocument: { content: fileBuffer, mimeType: mimeType },
        });

        const extractedText = docAiResult.document?.text || "";
        logger.info(`Extracted text from ${fileName}. Length: ${extractedText.length}`);

        const docRef = db.collection("processes").doc(processId).collection("extracted_texts").doc();
        // CORREÇÃO: Quebra de linha para o linter
        await docRef.set({
          processId,
          fileName,
          extractedAt: AdminTimestamp.now(),
          textLength: extractedText.length,
          textContent: extractedText,
        });

        logger.info(`Extracted text from ${fileName} saved to Firestore.`);
        res.status(200).send({
          success: true, message: "PDF processed successfully.", documentId: docRef.id,
        });
      } catch (error) {
        logger.error(`Error processing file ${fileName} with Document AI:`, error);
        res.status(500).send({ success: false, error: "Failed to process file with Document AI." });
      }
    });

    req.pipe(bb);
  });


// Parte 2: Função acionada pelo Firestore para gerar embeddings
function splitTextIntoChunks(text: string, chunkSize: number, chunkOverlap: number): string[] {
  if (chunkOverlap >= chunkSize) throw new Error("chunkOverlap must be smaller than chunkSize.");
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + chunkSize));
    i += chunkSize - chunkOverlap;
  }
  return chunks;
}

export const generateEmbeddingsForText = onDocumentCreated(
  { document: "processes/{processId}/extracted_texts/{textDocId}", memory: "1GiB", timeoutSeconds: 540 },
  async (event) => {
    const snap = event.data;
    if (!snap) {
      logger.error("[Embeddings] No data associated with the event."); return;
    }
    const { textContent, processId, fileName } = snap.data();
    if (!textContent || !processId || !fileName) {
      logger.error("[Embeddings] Document data is missing required fields."); return;
    }

    try {
      const chunks = splitTextIntoChunks(textContent, 1500, 150);
      logger.info(`[Embeddings] Text from "${fileName}" split into ${chunks.length} chunks.`);

      const embeddings = await embed({
        embedder: "googleai/text-embedding-004",
        content: chunks,
      });

      if (embeddings.length !== chunks.length) throw new Error("Mismatch between chunks and embeddings count.");

      const batch = db.batch();
      for (let i = 0; i < chunks.length; i++) {
        const chunkDocRef = db.collection("processes").doc(processId).collection("text_chunks").doc();
        batch.set(chunkDocRef, {
          processId, originalDocId: snap.id, originalFileName: fileName,
          chunkNumber: i + 1, totalChunks: chunks.length,
          chunkText: chunks[i], embedding: embeddings[i],
          createdAt: AdminTimestamp.now(),
        });
      }

      await batch.commit();
      logger.info(`[Embeddings] Successfully saved ${chunks.length} chunks for "${fileName}".`);
      await snap.ref.update({ status: "embeddings_generated" });
    } catch (error) {
      logger.error(`[Embeddings] Failed to generate embeddings for "${fileName}".`, error);
      await snap.ref.update({ status: "error_generating_embeddings", errorMessage: error instanceof Error ? error.message : String(error) });
    }
  },
);
