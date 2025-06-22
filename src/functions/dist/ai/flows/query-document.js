"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.queryDocumentFlow = void 0;
exports.runQueryDocumentFlow = runQueryDocumentFlow;
const flow_1 = require("@genkit-ai/flow");
const zod_1 = require("zod");
const firestore_1 = require("firebase-admin/firestore");
const googleai_1 = require("@genkit-ai/googleai");
const app_1 = require("firebase-admin/app");
// Initialize Firebase Admin SDK
try {
    (0, app_1.initializeApp)();
}
catch (e) {
    // Ignore the error if the app is already initialized
    if (e.code !== 'app/duplicate-app') {
        console.error('Firebase initialization error', e);
    }
}
const QueryDocumentInputSchema = zod_1.z.object({
    documentId: zod_1.z.string(),
    query: zod_1.z.string(),
});
const QueryDocumentOutputSchema = zod_1.z.object({
    answer: zod_1.z.string(),
});
async function queryDocumentLogic(input) {
    const personaSnapshot = await (0, firestore_1.getFirestore)().collection('config').doc('persona').get();
    const persona = personaSnapshot.data() || { name: 'AI Assistant', description: 'a helpful assistant' };
    console.log(`[${input.documentId}] Generating embedding for query: "${input.query}"`);
    const queryEmbedding = await (0, flow_1.runFlow)(embedText, input.query);
    console.log(`[${input.documentId}] Fetching embeddings from Firestore.`);
    const embeddingsSnapshot = await (0, firestore_1.getFirestore)()
        .collection('documents')
        .doc(input.documentId)
        .collection('embeddings')
        .get();
    if (embeddingsSnapshot.empty) {
        console.warn(`[${input.documentId}] No embeddings found for this document.`);
        return { answer: "I'm sorry, but I couldn't find any content in the document to search." };
    }
    const documentEmbeddings = embeddingsSnapshot.docs
        .map(doc => ({
        chunkId: doc.id,
        embedding: doc.data().embedding,
    }))
        .filter(doc => Array.isArray(doc.embedding) && doc.embedding.length > 0);
    const distances = documentEmbeddings.map(doc => ({
        chunkId: doc.chunkId,
        distance: cosineSimilarity(queryEmbedding, doc.embedding),
    }));
    distances.sort((a, b) => b.distance - a.distance);
    const topN = 5;
    const relevantChunkIds = distances.slice(0, topN).map(d => d.chunkId);
    if (relevantChunkIds.length === 0) {
        return { answer: "I'm sorry, I was unable to find relevant information in the document to answer your question." };
    }
    console.log(`[${input.documentId}] Fetching content for top ${relevantChunkIds.length} relevant chunks.`);
    const chunkPromises = relevantChunkIds.map(chunkId => (0, firestore_1.getFirestore)()
        .collection('documents')
        .doc(input.documentId)
        .collection('chunks')
        .doc(chunkId)
        .get());
    const chunkSnapshots = await Promise.all(chunkPromises);
    const relevantChunks = chunkSnapshots
        .map(doc => ({
        content: doc.exists ? doc.data()?.text || '' : ''
    }))
        .filter(chunk => chunk.content);
    console.log(`[${input.documentId}] Retrieved chunks:`, relevantChunks.map(c => c.content.substring(0, 100) + '...'));
    const documentContent = relevantChunks.map(c => c.content).join('----');
    const systemPrompt = `You are ${persona.name}, ${persona.description}. Answer the user's QUESTION based on the provided DOCUMENT content. If the user asks for a summary, please provide a comprehensive summary of the document.`;
    const llmResponse = await googleai_1.geminiPro.generate({
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
const embedText = (0, flow_1.defineFlow)({
    name: 'embedText',
    inputSchema: zod_1.z.string(),
    outputSchema: zod_1.z.array(zod_1.z.number()),
}, async (text) => {
    const embedding = await googleai_1.textEmbedding004.embed({ content: text });
    return embedding.embedding;
});
exports.queryDocumentFlow = (0, flow_1.defineFlow)({
    name: 'queryDocumentFlow',
    inputSchema: QueryDocumentInputSchema,
    outputSchema: QueryDocumentOutputSchema,
}, queryDocumentLogic);
async function runQueryDocumentFlow(input) {
    console.log("Running queryDocumentFlow via runQueryDocumentFlow wrapper.");
    const result = await (0, flow_1.runFlow)(exports.queryDocumentFlow, input);
    return result;
}
function cosineSimilarity(vecA, vecB) {
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
//# sourceMappingURL=query-document.js.map