"use server"
import * as z from 'zod';
import {
  Document,
  defineFlow,
  findMostRelevant,
  generate,
  genkit,
} from 'genkit';
import { getFirestore } from 'firebase-admin/firestore';
import { Document as IFirestoreDocument } from 'firebase-admin/firestore';
import { embed } from '@genkit-ai/ai';
import { chunk } from 'llm-chunk';
import { googleAI } from '@genkit-ai/googleai';

genkit({
  plugins: [googleAI()],
});

export const queryDocumentFlow = defineFlow(
  {
    name: 'queryDocumentFlow',
    inputSchema: z.object({
      query: z.string(),
      documentId: z.string(),
    }),
    outputSchema: z.object({
      answer: z.string(),
    }),
  },
  async (input) => {
    // 1. Get the persona from Firestore.
    // TODO: The persona should be configurable.
    const persona = (
      await getFirestore().collection('personas').doc('default').get()
    ).data();

    if (!persona) {
      throw new Error(
        'Persona not found. Please configure a persona in the Firestore database.',
      );
    }

    // 2. Prepare the prompt for the user's query.
    const history = [
      {
        role: 'user' as const,
        content: `You are a helpful assistant that can answer questions about a document. Your name is ${persona.name}. You are ${persona.description}.

        The user has provided the following document. Please answer the user's question based on the document.
        
        DOCUMENT:
        """""
        {{document}}
        """""
        
        QUESTION:
        """""
        {{query}}
        """""`,
      },
    ];

    // 3. Generate embedding for the user's query.
    console.log(
      `[${input.documentId}] Generating embedding for query: "${input.query}"`,
    );
    const queryEmbedding = await embed({
      embedder: 'googleai/text-embedding-004',
      content: input.query,
    });

    // 4. Fetch all chunk embeddings for the specified document.
    console.log(
      `[${input.documentId}] Fetching embeddings from Firestore.`,
    );
    const chunksSnapshot = await getFirestore()
      .collection('documents')
      .doc(input.documentId)
      .collection('chunks')
      .get();

    const chunks = chunksSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        text: data.text,
        embedding: data.embedding,
      };
    });

    // 5. Find the most relevant chunks to the user's query.
    console.log(
      `[${input.documentId}] Finding most relevant chunks to the query.`,
    );
    const relevantChunks = findMostRelevant(
      queryEmbedding,
      chunks.map((chunk) => ({
        content: chunk.text,
        embedding: chunk.embedding,
      })),
      5,
    );

    // 6. Generate the answer.
    console.log(`[${input.documentId}] Generating answer.`);
    const llmResponse = await generate({
      model: 'googleai/gemini-1.5-flash',
      prompt: {
        ...history,
      },
      context: relevantChunks,
      input: {
        query: input.query,
      },
    });

    return {
      answer: llmResponse.text(),
    };
  },
);
