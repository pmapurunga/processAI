
import { defineFlow } from '@genkit-ai/flow';
import * as z from 'zod';
import { getFirestore } from 'firebase-admin/firestore';
import { embed, generate } from '@genkit-ai/ai';
import { geminiPro, textEmbedding004 } from '@genkit-ai/googleai';
import { IndexEndpointServiceClient } from '@google-cloud/aiplatform';

const firestore = getFirestore();
const indexEndpointServiceClient = new IndexEndpointServiceClient();

// Configuration for Vertex AI Vector Search
// TODO: Replace with your actual configuration or move to environment variables
const project = 'your-gcp-project-id';
const location = 'us-central1';
const indexEndpointId = 'your-vector-search-index-endpoint-id';
const deployedIndexId = 'your-deployed-index-id'; // This ID is found on your Index Endpoint page

export const ragChatFlow = defineFlow(
  {
    name: 'ragChat',
    inputSchema: z.object({
      processId: z.string(),
      query: z.string(),
    }),
    outputSchema: z.object({
      response: z.string(),
    }),
  },
  async (input) => {
    const { processId, query } = input;

    // 1. Generate an embedding for the user's query
    const queryEmbedding = await embed(textEmbedding004, query);

    // 2. Find relevant text chunks using Vertex AI Vector Search
    const endpointName = indexEndpointServiceClient.indexEndpointPath(project, location, indexEndpointId);
    
    const [findNeighborsResponse] = await indexEndpointServiceClient.findNeighbors({
      indexEndpoint: endpointName,
      deployedIndexId: deployedIndexId,
      queries: [{
        datapoint: {
          feature_vector: queryEmbedding[0],
        },
        neighborCount: 5, // Retrieve the top 5 most similar chunks
      }],
    });
    
    const neighborIds = findNeighborsResponse.nearestNeighbors?.[0]?.neighbors?.map(n => n.datapoint?.datapointId) ?? [];

    if (neighborIds.length === 0) {
      return { response: "Não foi possível encontrar informações relevantes nos documentos." };
    }

    // 3. Retrieve the actual text of the chunks from Firestore
    const chunkDocs = await Promise.all(
      neighborIds.map(chunkId => firestore.collection('processes').doc(processId).collection('chunks').doc(chunkId).get())
    );
    const relevantChunks = chunkDocs.map(doc => doc.data()?.text).filter(text => text);

    // 4. Construct the prompt for the Gemini model
    const prompt = `
      You are "ProcessAI Consultor Jurídico", a precise and objective legal assistant.
      Your role is to answer questions based ONLY on the context provided below.
      If the answer is not found within the context, you must state: "Não encontrei essa informação nos documentos fornecidos."
      Do not invent, infer, or use any external knowledge.

      Context:
      ---
      ${relevantChunks.join('

')}
      ---

      User's Question:
      ${query}
    `;

    // 5. Generate a response using the Gemini model
    const llmResponse = await generate({
      model: geminiPro,
      prompt: prompt,
      config: {
        temperature: 0.1,
      },
    });

    return { response: llmResponse.text() };
  }
);
