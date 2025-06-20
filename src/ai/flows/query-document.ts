
"use server"
import * as z from 'zod';
import { Document, findMostRelevant } from 'genkit';
import { getFirestore } from 'firebase-admin/firestore';
// Removed Document as IFirestoreDocument to avoid conflict with genkit/Document
// import { Document as IFirestoreDocument } from 'firebase-admin/firestore';
import { ai } from '@/ai/genkit.config'; // Use the centrally configured AI instance

// Persona data structure (can be expanded)
interface Persona {
  name: string;
  description: string;
}

export const QueryDocumentInputSchema = z.object({
  query: z.string(),
  documentId: z.string(),
});
export type QueryDocumentInput = z.infer<typeof QueryDocumentInputSchema>;

export const QueryDocumentOutputSchema = z.object({
  answer: z.string(),
});
export type QueryDocumentOutput = z.infer<typeof QueryDocumentOutputSchema>;


export async function queryDocumentFlow(input: QueryDocumentInput): Promise<QueryDocumentOutput> {
  // 1. Get the persona from Firestore.
  const personaSnapshot = await getFirestore().collection('personas').doc('default').get();
  
  if (!personaSnapshot.exists) {
    throw new Error(
      'Persona not found. Please configure a persona in the Firestore database.',
    );
  }
  const persona = personaSnapshot.data() as Persona;


  // 2. Prepare the prompt for the user's query.
  // The prompt itself is now part of the ai.generate call context or system prompt if needed.
  // For this structure, we'll format the input for the generate call.

  // 3. Generate embedding for the user's query.
  console.log(
    `[${input.documentId}] Generating embedding for query: "${input.query}"`,
  );
  const queryEmbedding = await ai.embed({
    content: input.query, // Uses default embedder from genkit.config.ts
  });

  // 4. Fetch all chunk embeddings for the specified document.
  console.log(
    `[${input.documentId}] Fetching embeddings from Firestore.`,
  );
  const chunksSnapshot = await getFirestore()
    .collection('documents')
    .doc(input.documentId)
    .collection('chunks') // Assuming chunks are stored here
    .get();

  // We need to fetch embeddings from the 'embeddings' subcollection as per 'functions/index.ts'
  const embeddingsSnapshot = await getFirestore()
    .collection('documents')
    .doc(input.documentId)
    .collection('embeddings')
    .get();
  
  const chunkTexts: Record<string, string> = {};
  chunksSnapshot.forEach(doc => {
    chunkTexts[doc.id] = doc.data().text;
  });

  const documentChunksWithEmbeddings = embeddingsSnapshot.docs.map((doc) => {
    const data = doc.data();
    const chunkId = doc.id; // or data.chunkId if stored explicitly
    return Document.fromText(chunkTexts[chunkId] || '', { // text comes from 'chunks' collection
      chunkId: chunkId, // Pass chunkId in metadata
      embedding: data.vector, // embedding comes from 'embeddings' collection
    });
  }).filter(doc => doc.text()); // Ensure we only include chunks with text


  if (documentChunksWithEmbeddings.length === 0) {
     console.warn(`[${input.documentId}] No text chunks or embeddings found for this document.`);
     // Decide how to handle: throw error or return a specific message
     return { answer: "I'm sorry, but I couldn't find any content in the document to search." };
  }


  // 5. Find the most relevant chunks to the user's query.
  console.log(
    `[${input.documentId}] Finding most relevant chunks to the query.`,
  );
  // findMostRelevant expects an array of Document objects or objects with {content, embedding}
  // Our Document.fromText above already includes embeddings in its metadata if `embedding` field is standard
  // Let's ensure findMostRelevant can use Document objects directly or adapt.
  // The Genkit Document type can hold an embedding in its metadata.
  // We need to make sure `findMostRelevant` can access it.
  // If `findMostRelevant` expects `data.embedding`, we might need to map.
  // From docs, findMostRelevant wants an array of `Document<z.ZodTypeAny> | DocumentData<z.ZodTypeAny>`
  // and DocumentData is `{ content: string; embedding?: number[] | Float32Array; }`

  const relevantChunks = findMostRelevant(
    queryEmbedding, // This is number[]
    documentChunksWithEmbeddings.map(doc => ({
        content: doc.text(), // Text content of the chunk
        embedding: doc.metadata?.embedding || [], // Embedding vector. Ensure this path is correct.
    })),
    5 // Number of relevant chunks to retrieve
  ).map(chunk => Document.fromText(chunk.content || '')); // Convert back to Document objects for context


  // 6. Generate the answer.
  console.log(`[${input.documentId}] Generating answer.`);
  const llmResponse = await ai.generate({
    // model: 'googleai/gemini-1.5-flash', // Uses default model from genkit.config.ts
    prompt: `You are ${persona.name}, ${persona.description}.
      Answer the user's QUESTION based on the provided DOCUMENT content.

      DOCUMENT:
      """""
      {{#each context}}
      {{this.content}}
      -----
      {{/each}}
      """""
      
      QUESTION:
      """""
      ${input.query}
      """""`,
    context: relevantChunks, // Pass relevant Document objects as context
    // input variables for the prompt template are implicitly from the prompt string if not using schema
  });

  return {
    answer: llmResponse.text(),
  };
}

// Defining the flow with ai.defineFlow allows it to be discoverable by Genkit tools
// and provides better integration with the Genkit ecosystem.
// However, since `queryDocumentFlow` is directly exported and used,
// this explicit `ai.defineFlow` wrapper might be redundant if not called via Genkit's flow execution mechanisms elsewhere.
// For now, the exported async function `queryDocumentFlow` is what `actions.ts` calls.
// If we want to make it a formal Genkit flow runnable via CLI or other tools, we'd do:
/*
const queryDocumentGenkitFlow = ai.defineFlow(
  {
    name: 'queryDocumentFlow', // Name for Genkit to identify the flow
    inputSchema: QueryDocumentInputSchema,
    outputSchema: QueryDocumentOutputSchema,
  },
  queryDocumentFlow // Pass the async function directly
);
// Then actions.ts would import and call queryDocumentGenkitFlow
*/
// For simplicity, and since actions.ts already calls the async function, we'll keep it as is.
// The key was to use ai.embed and ai.generate.
