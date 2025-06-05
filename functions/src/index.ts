
/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 * import {onObjectFinalized} from "firebase-functions/v2/storage";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK.
// Isso é geralmente necessário se suas funções interagem com outros serviços do Firebase, como Firestore ou Auth.
// Se você já inicializou em outro lugar (o que não é comum para funções), pode não precisar.
if (admin.apps.length === 0) {
  admin.initializeApp();
}

/**
 * Exemplo de uma função HTTP simples.
 * Você pode acessá-la via URL após o deploy.
 */
export const helloWorld = onRequest((request, response) => {
  logger.info("Hello logs!", {structuredData: true});
  response.send("Hello from Firebase Functions!");
});

// Para usar Firebase Functions para processamento assíncrono, você consideraria gatilhos como:
//
// 1. Gatilho do Cloud Storage (onObjectFinalized):
//    Útil para processar arquivos após o upload.
//    Exemplo de assinatura:
//    export const analyzeUploadedDocument = onObjectFinalized(async (event) => {
//      const fileBucket = event.data.bucket; // O bucket do Storage onde o arquivo foi carregado.
//      const filePath = event.data.name; // O caminho do arquivo no bucket.
//      const contentType = event.data.contentType; // O tipo de conteúdo do arquivo.
//
//      logger.info(`New file uploaded: ${filePath} in bucket ${fileBucket}`);
//
//      // Aqui você adicionaria sua lógica de análise de IA,
//      // possivelmente usando Genkit se você o configurar para Functions.
//      // Lembre-se de configurar o Genkit separadamente para o ambiente de Functions
//      // se ele depender de variáveis de ambiente ou autenticação específicas.
//
//      // Exemplo: baixar o arquivo do Storage, analisar, salvar resultados no Firestore.
//      // Depois, talvez deletar o arquivo do Storage.
//
//      return; // Ou retornar uma promessa
//    });
//
// 2. Gatilho do Firestore (onDocumentWritten, onDocumentCreated, etc.):
//    Útil para reagir a mudanças nos seus dados do Firestore.
//    Exemplo de assinatura:
//    export const processNewProcessEntry = onDocumentWritten("processes/{processId}", async (event) => {
//      if (!event.data?.after.exists) {
//        logger.info(`Process ${event.params.processId} deleted.`);
//        return;
//      }
//      const processData = event.data.after.data();
//      logger.info(`Process ${event.params.processId} written:`, processData);
//
//      // Lógica a ser executada quando um documento de processo é criado ou atualizado.
//
//      return;
//    });
//
// 3. Funções Chamáveis (onCall):
//    Permitem que seu aplicativo cliente chame diretamente uma função como se fosse uma API RPC.
//    Exemplo de assinatura:
//    export const myCallableFunction = onCall((request) => {
//      // request.auth contém informações sobre o usuário autenticado, se houver.
//      // request.data contém os dados enviados pelo cliente.
//      const text = request.data.text;
//      logger.info(`Callable function received text: ${text}, by user: ${request.auth?.uid}`);
//      return { message: `Received: ${text}` };
//    });

// Para começar a implementar sua lógica:
// 1. Defina o gatilho da sua função (HTTP, Storage, Firestore, Pub/Sub, Agendada, etc.).
// 2. Escreva a lógica da função.
// 3. Exporte a função.
// 4. Para fazer o deploy, você pode usar o comando `firebase deploy --only functions` na raiz do seu projeto
//    ou o script `npm run deploy` dentro do diretório `functions` (que já existe).

// Lembre-se que:
// - As Cloud Functions têm seu próprio ambiente. Se você usar Genkit dentro delas,
//   certifique-se de que as chaves de API ou a autenticação do Google Cloud (via conta de serviço da função)
//   estejam configuradas corretamente para os serviços de IA que o Genkit utiliza.
// - Adicione quaisquer dependências específicas para suas funções ao `functions/package.json`
//   e execute `npm install` dentro do diretório `functions/` antes de fazer o deploy.
