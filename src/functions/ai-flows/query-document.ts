import { embed } from '@genkit-ai/ai';
import * as genkit from '@genkit-ai/core';
import { defineFlow, runFlow } from '@genkit-ai/flow';
import { gemini15Pro } from '@genkit-ai/googleai';
import { getFirestore } from 'firebase-admin/firestore';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import { getPlugins } from './genkit.config';

// In the functions environment, we get the initialized admin instance.
const db = getFirestore();

const QueryDocumentInputSchema = z.object({
  documentId: z.string(),
  query: z.string(),
});

type QueryDocumentInput = z.infer<typeof QueryDocumentInputSchema>;

const QueryDocumentOutputSchema = z.object({
  answer: z.string(),
});

type QueryDocumentOutput = z.infer<typeof QueryDocumentOutputSchema>;

async function queryDocumentLogic(
  input: QueryDocumentInput,
): Promise<QueryDocumentOutput> {
  const personaSnapshot = await db
    .collection('config')
    .doc('persona')
    .get();
  const persona = personaSnapshot.data() || {
    name: 'AI Assistant',
    description: 'a helpful assistant',
  };

  console.log(
    `[${input.documentId}] Generating embedding for query: "${input.query}"`,
  );
  const queryEmbedding = await runFlow(embedText, input.query);

  console.log(`[${input.documentId}] Fetching embeddings from Firestore.`);
  const embeddingsSnapshot = await db
    .collection('documents')
    .doc(input.documentId)
    .collection('embeddings')
    .get();

  if (embeddingsSnapshot.empty) {
    console.warn(`[${input.documentId}] No embeddings found for this document.`);
    return {
      answer: "I'm sorry, but I couldn't find any content in the document to search.",
    };
  }

  const documentEmbeddings = embeddingsSnapshot.docs
    .map((doc) => ({
      chunkId: doc.id,
      embedding: doc.data().embedding,
    }))
    .filter((doc) => Array.isArray(doc.embedding) && doc.embedding.length > 0);

  const distances = documentEmbeddings.map((doc) => ({
    chunkId: doc.chunkId,
    distance: cosineSimilarity(queryEmbedding, doc.embedding),
  }));

  distances.sort((a, b) => b.distance - a.distance);

  const topN = 5;
  const relevantChunkIds = distances.slice(0, topN).map((d) => d.chunkId);

  if (relevantChunkIds.length === 0) {
    return {
      answer:
        "I'm sorry, I was unable to find relevant information in the document to answer your question.",
    };
  }

  console.log(
    `[${input.documentId}] Fetching content for top ${relevantChunkIds.length} relevant chunks.`,
  );

  const chunkPromises = relevantChunkIds.map((chunkId) =>
    db
      .collection('documents')
      .doc(input.documentId)
      .collection('chunks')
      .doc(chunkId)
      .get(),
  );

  const chunkSnapshots = await Promise.all(chunkPromises);
  const relevantChunks = chunkSnapshots
    .map((doc) => ({
      content: doc.exists ? doc.data()?.text || '' : '',
    }))
    .filter((chunk) => chunk.content);

  console.log(
    `[${input.documentId}] Retrieved chunks:`,
    relevantChunks.map((c) => c.content.substring(0, 100) + '...'),
  );

  const documentContent = relevantChunks.map((c) => c.content).join('----');

  const systemPrompt = `You are ${persona.name}, ${persona.description}. Answer the user's QUESTION based on the provided DOCUMENT content. If the user asks for a summary, please provide a comprehensive summary of the document.`;

  const llmResponse = await gemini15Pro.generate({
    system: systemPrompt,
    prompt: `DOCUMENT:
${documentContent}

QUESTION:
${input.query}`,
  });

  return {
    answer: llmResponse.text(),
  };
}

const embedText = defineFlow(
  {
    name: 'embedText',
    inputSchema: z.string(),
    outputSchema: z.array(z.number()),
  },
  async (text) => {
    const { embedding } = await embed({
      embedder: 'googleAI/text-embedding-004',
      content: text,
    });
    return embedding;
  },
);

export const queryDocumentFlow = defineFlow(
  {
    name: 'queryDocumentFlow',
    inputSchema: QueryDocumentInputSchema,
    outputSchema: QueryDocumentOutputSchema,
  },
  queryDocumentLogic,
);

export async function runQueryDocumentFlow(
  input: QueryDocumentInput,
): Promise<QueryDocumentOutput> {
  console.log('Running queryDocumentFlow via runQueryDocumentFlow wrapper.');
  
  genkit.configure({
    plugins: getPlugins(),
    logLevel: 'debug',
    enableTracingAndMetrics: true,
  });
  
  const result = await runFlow(queryDocumentFlow, input);
  return result;
}

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length) {
    return 0;
  }
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) {
    return 0;
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
