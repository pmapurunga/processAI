import { defineFlow } from '@genkit-ai/flow';
import * as z from 'zod';
import { getFirestore } from 'firebase-admin/firestore';
import { embed, generate } from '@genkit-ai/ai';
import { geminiPro, textEmbedding004 } from '@genkit-ai/googleai';
import { IndexEndpointServiceClient } from '@google-cloud/aiplatform';

const firestore = getFirestore();
const indexEndpointServiceClient = new IndexEndpointServiceClient();

// Carrega as configurações das variáveis de ambiente
const project = process.env.GCP_PROJECT;
const location = process.env.GCP_LOCATION;
const indexEndpointId = process.env.VERTEX_INDEX_ENDPOINT_ID;
const deployedIndexId = process.env.VERTEX_DEPLOYED_INDEX_ID;

// Validação para garantir que as variáveis de ambiente foram configuradas
if (!project || !location || !indexEndpointId || !deployedIndexId) {
  throw new Error(
    'Variáveis de ambiente do Vertex AI não configuradas. ' +
    'Execute "firebase functions:config:set" para gcp.project, gcp.location, vertex.index_endpoint_id, e vertex.deployed_index_id'
  );
}

export const ragChatFlow = defineFlow(
  {
    name: 'ragChatFlow',
    inputSchema: z.object({
      processId: z.string(),
      query: z.string(),
      history: z.array(z.object({
        role: z.enum(['user', 'model']),
        content: z.string(),
      })).optional(),
    }),
    outputSchema: z.string(),
  },
  async (input) => {
    const { processId, query } = input;

    // 1. Generate an embedding for the user's query
    const queryEmbeddingResponse = await embed({
      embedder: textEmbedding004,
      content: query,
    });
    const queryEmbedding = queryEmbeddingResponse.embedding;

    // 2. Find relevant text chunks using Vertex AI Vector Search
    const endpointName = indexEndpointServiceClient.indexEndpointPath(project, location, indexEndpointId);
    
    const [findNeighborsResponse] = await indexEndpointServiceClient.findNeighbors({
      indexEndpoint: endpointName,
      deployedIndexId: deployedIndexId,
      queries: [{
        datapoint: {
          feature_vector: queryEmbedding,
        },
        neighborCount: 5,
      }],
    });
    
    const neighborIds = findNeighborsResponse.nearestNeighbors?.[0]?.neighbors?.map(n => n.datapoint?.datapointId).filter((id): id is string => !!id) ?? [];

    if (neighborIds.length === 0) {
      return "Não foi possível encontrar informações relevantes nos documentos.";
    }

    // 3. Retrieve the actual text of the chunks from Firestore
    const chunkDocs = await Promise.all(
      neighborIds.map(chunkId => firestore.collection('processes').doc(processId).collection('chunks').doc(chunkId).get())
    );
    const relevantChunks = chunkDocs.map(doc => doc.data()?.text).filter(text => text);

    // 4. Construct the prompt for the Gemini model
    const prompt = `
      Você é "ProcessAI Consultor Jurídico", um assistente jurídico preciso e objetivo.
      Sua função é responder perguntas baseando-se SOMENTE no contexto fornecido abaixo.
      Se a resposta não for encontrada no contexto, você deve afirmar: "Não encontrei essa informação nos documentos fornecidos."
      Não invente, infira ou utilize qualquer conhecimento externo.

      Contexto:
      ---
      ${relevantChunks.join('\n\n')}
      ---

      Pergunta do Usuário:
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

    return llmResponse.text();
  }
);