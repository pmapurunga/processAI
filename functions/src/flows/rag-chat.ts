import { defineFlow } from '@genkit-ai/flow';
import * as z from 'zod';
import { getFirestore } from 'firebase-admin/firestore';
import { embed, generate } from '@genkit-ai/ai';
import { geminiPro, textEmbedding004 } from '@genkit-ai/googleai';
import { IndexEndpointServiceClient } from '@google-cloud/aiplatform';

const firestore = getFirestore();
const indexEndpointServiceClient = new IndexEndpointServiceClient();

const project = process.env.GCP_PROJECT;
const location = process.env.GCP_LOCATION;
const indexEndpointId = process.env.VERTEX_INDEX_ENDPOINT_ID;
const deployedIndexId = process.env.VERTEX_DEPLOYED_INDEX_ID;

if (!project || !location || !indexEndpointId || !deployedIndexId) {
  throw new Error('Vertex AI environment variables are not set.');
}

export const ragChatFlow = defineFlow(
  {
    name: 'ragChatFlow',
    inputSchema: z.object({
      processId: z.string(),
      query: z.string(),
      history: z
        .array(
          z.object({
            role: z.enum(['user', 'model']),
            content: z.string(),
          })
        )
        .optional(),
    }),
    outputSchema: z.string(),
  },
  async (input) => {
    const { processId, query, history } = input;

    const queryEmbeddingResponse = await embed({
      embedder: textEmbedding004,
      content: query,
    });
    const queryEmbedding = queryEmbeddingResponse.embedding;

    const endpointName = indexEndpointServiceClient.indexEndpointPath(
      project,
      location,
      indexEndpointId
    );

    const [findNeighborsResponse] =
      await indexEndpointServiceClient.findNeighbors({
        indexEndpoint: endpointName,
        deployedIndexId: deployedIndexId,
        queries: [
          {
            datapoint: {
              feature_vector: queryEmbedding,
            },
            neighborCount: 5,
          },
        ],
      });

    const neighborIds =
      findNeighborsResponse.nearestNeighbors?.[0]?.neighbors
        ?.map((n) => n.datapoint?.datapointId)
        .filter((id): id is string => !!id) ?? [];

    if (neighborIds.length === 0) {
      return 'Could not find relevant information in the documents to answer your question.';
    }

    const chunkDocs = await Promise.all(
      neighborIds.map((chunkId) =>
        firestore
          .collection('processes')
          .doc(processId)
          .collection('chunks')
          .doc(chunkId)
          .get()
      )
    );
    const relevantChunks = chunkDocs
      .map((doc) => doc.data()?.text)
      .filter((text): text is string => !!text);

    const systemInstruction =
      'You are "ProcessAI Legal Advisor", a precise and objective legal assistant. Your function is to answer questions based ONLY on the context provided below. If the answer is not found in the context, you must state: "I did not find this information in the provided documents." Do not invent, infer, or use any external knowledge.';

    const contextHeader = 'Relevant Document Context:';
    const separator = '---';
    const contextBody = relevantChunks.join('

---

');

    const promptParts = [
      systemInstruction,
      contextHeader,
      separator,
      contextBody,
      separator,
      'User Question: ' + query,
    ];

    const finalPrompt = promptParts.join('

');

    const llmResponse = await generate({
      model: geminiPro,
      prompt: finalPrompt,
      history: history,
      config: {
        temperature: 0.1,
      },
    });

    return llmResponse.text();
  }
);
