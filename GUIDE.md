# Guia de Configuração do Projeto "ProcessAI"

Este guia fornece um passo a passo completo para configurar a infraestrutura de backend e conectar o frontend do projeto "ProcessAI", seguindo as melhores práticas para uma arquitetura RAG (Retrieval Augmented Generation) com Next.js, Firebase e Google Cloud AI.

## Índice

1.  [Configuração Inicial do Projeto no Google Cloud e Firebase](#1-configuração-inicial-do-projeto-no-google-cloud-e-firebase)
2.  [Configuração de Serviços Firebase](#2-configuração-de-serviços-firebase)
3.  [Integração com Google Cloud AI e Genkit](#3-integração-com-google-cloud-ai-e-genkit)
4.  [Estrutura de Projeto Sugerida](#4-estrutura-de-projeto-sugerida)
5.  [Considerações de Segurança](#5-considerações-de-segurança)
6.  [Comandos Essenciais do Firebase CLI](#6-comandos-essenciais-do-firebase-cli)

---

## 1. Configuração Inicial do Projeto no Google Cloud e Firebase

Esta seção aborda a criação e configuração inicial dos projetos no Google Cloud e Firebase.

### 1.1. Criação de um Novo Projeto no Google Cloud

1.  **Acesse o Google Cloud Console:** [https://console.cloud.google.com/](https://console.cloud.google.com/).
2.  **Crie um Novo Projeto:**
    *   No seletor de projetos, clique em **"Novo projeto"**.
    *   Defina um nome para o projeto (e.g., `processai-project`) e anote o **ID do projeto**.
3.  **Associe uma Conta de Faturamento:**
    *   Para utilizar as APIs do Google Cloud, seu projeto precisa de uma conta de faturamento ativa. Acesse a seção **"Faturamento"** para configurá-la.

### 1.2. Habilitação das APIs Necessárias

1.  No painel do seu projeto, navegue até **"APIs e serviços" > "Biblioteca"**.
2.  Pesquise e habilite as seguintes APIs:
    *   `Cloud Firestore API`
    *   `Cloud Storage`
    *   `Cloud Functions API`
    *   `Cloud Run Admin API`
    *   `Cloud Build API`
    *   `Cloud Vision AI API`
    *   `Vertex AI API`
    *   `IAM API` (iam.googleapis.com)
    *   `IAM Service Account Credentials API` (iamcredentials.googleapis.com)
    *   `Google AI Generative Language API`
    *   `Artifact Registry API`

### 1.3. Criação e Configuração de um Projeto Firebase

1.  **Acesse o Firebase Console:** [https://console.firebase.google.com/](https://console.firebase.google.com/).
2.  **Adicione um Projeto:**
    *   Clique em **"Adicionar projeto"** e selecione o projeto do Google Cloud criado anteriormente.
3.  **Atualize para o Plano Blaze:**
    *   As Cloud Functions de 2ª geração exigem o plano **"Blaze (pagamento por utilização)"**. No menu do projeto, clique em **"Atualizar"**.
4.  **Configure a Aplicação Web (Frontend):**
    *   No painel do projeto, clique no ícone da web (`</>`) para registrar seu aplicativo Next.js.
    *   Dê um nome ao aplicativo (e.g., `processai-webapp`).
    *   Copie o objeto de configuração `firebaseConfig` para usar no seu frontend.

---

## 2. Configuração de Serviços Firebase

### 2.1. Firestore

#### 2.1.1. Estrutura de Dados Sugerida

A seguir, uma sugestão de estrutura de coleções e documentos para o Firestore, projetada para ser escalável e segura.

**Coleção `users`:**
Armazena informações básicas sobre os usuários.

```
/users/{userId}
  - email: string
  - createdAt: timestamp
```

**Coleção `documents`:**
Contém os metadados de cada documento processado.

```
/documents/{documentId}
  - userId: string (FK para a coleção `users`)
  - fileName: string
  - originalPath: string (caminho no Cloud Storage)
  - status: 'uploading' | 'processing' | 'processed' | 'error'
  - createdAt: timestamp
  - updatedAt: timestamp
  - summary: string (gerado pela função de sumarização)
  - errorDetails: string (em caso de falha no processamento)
```

**Subcoleção `chunks`:**
Armazena os "chunks" de texto extraídos de cada documento.

```
/documents/{documentId}/chunks/{chunkId}
  - text: string
  - pageNumber: number
  - metadata: object (outros metadados relevantes, como títulos de seção)
  - embeddingVectorId: string (ID do vetor no Vertex AI Vector Search)
```

**Coleção `chats`:**
Gerencia as sessões de chat.

```
/chats/{chatId}
  - userId: string
  - documentId: string
  - createdAt: timestamp
  - firstMessagePreview: string
```

**Subcoleção `messages`:**
Armazena as mensagens de cada chat.

```
/chats/{chatId}/messages/{messageId}
  - text: string
  - sender: 'user' | 'ai'
  - createdAt: timestamp
  - sources: array (opcional, para rastrear os chunks usados na resposta)
    - { chunkId: string, pageNumber: number }
```

#### 2.1.2. Regras de Segurança para Firestore

Estas regras garantem que os usuários só possam acessar e modificar seus próprios dados.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Os usuários podem ler e escrever seus próprios perfis.
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Os usuários podem criar, ler, atualizar e deletar seus próprios documentos.
    match /documents/{documentId} {
      allow read, update, delete: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;

      // Apenas as Cloud Functions (ou seja, o backend) podem ler/escrever chunks.
      match /chunks/{chunkId} {
        allow read, write: if false; // Bloqueia o acesso do cliente
      }
    }

    // Os usuários podem criar e ler seus próprios chats.
    match /chats/{chatId} {
      allow create, read: if request.auth != null && request.auth.uid == request.resource.data.userId;

      // Os usuários podem ler e escrever mensagens em seus próprios chats.
      match /messages/{messageId} {
        allow read, write: if request.auth != null && get(/databases/$(database)/documents/chats/$(chatId)).data.userId == request.auth.uid;
      }
    }
  }
}
```

### 2.2. Cloud Storage

#### 2.2.1. Criação de Buckets

*   O Firebase cria um bucket padrão para você (`<seu-id-de-projeto>.appspot.com`). É recomendável usá-lo para os uploads dos usuários para simplificar as regras de segurança.

#### 2.2.2. Regras de Segurança para Cloud Storage

Estas regras permitem que apenas usuários autenticados façam upload de arquivos em uma pasta específica com seu `userId`.

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Apenas usuários autenticados podem fazer upload, e apenas na sua própria pasta.
    // O nome do arquivo deve ser um UUID para evitar colisões.
    // O tamanho do arquivo é limitado a 100MB.
    match /uploads/{userId}/{fileName} {
      allow read, write: if request.auth != null && request.auth.uid == userId
                          && request.resource.size < 100 * 1024 * 1024
                          && request.resource.contentType.matches('application/pdf');
    }
  }
}
```

### 2.3. Cloud Functions (Cloud Run - Cloud Functions 2ª Geração)

#### 2.3.1. Estrutura Básica do `index.ts`

Este arquivo (`functions/src/index.ts`) é o ponto de entrada para todas as suas Cloud Functions.

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { onObjectFinalized } from 'firebase-functions/v2/storage';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { run } from '@genkit-ai/core';

// Importe seus flows do Genkit
import { createDocumentEmbeddings } from './genkit-flows/create-document-embeddings';
import { ragChat } from './genkit-flows/rag-chat';
import { extractSummary } from './genkit-flows/extract-summary';

// Inicialize o Firebase Admin SDK
admin.initializeApp();

const db = admin.firestore();

// Função de Ingestão: Acionada pelo upload de um PDF no Cloud Storage
export const onPdfUpload = onObjectFinalized({
    bucket: process.env.RAW_PDF_BUCKET, // Defina nas variáveis de ambiente
    memory: '1GiB', // Aumente a memória se os PDFs forem grandes
    timeoutSeconds: 540,
}, async (event) => {
    const filePath = event.data.name;
    const bucket = event.data.bucket;

    // Extrai o userId e o documentId do caminho do arquivo
    const [_, userId, documentId] = filePath.split('/');

    if (!userId || !documentId) {
        functions.logger.error('Caminho do arquivo inválido:', filePath);
        return;
    }

    try {
        // Atualiza o status do documento para 'processing'
        await db.doc(`documents/${documentId}`).update({ status: 'processing' });

        // Executa o flow do Genkit para processar o documento
        await run(createDocumentEmbeddings, { bucket, filePath, documentId });

        // Atualiza o status para 'processed'
        await db.doc(`documents/${documentId}`).update({ status: 'processed', updatedAt: admin.firestore.FieldValue.serverTimestamp() });

    } catch (error) {
        functions.logger.error('Erro no processamento do documento:', error);
        await db.doc(`documents/${documentId}`).update({ status: 'error', errorDetails: (error as Error).message });
    }
});

// Função de Chat: Acionada por uma chamada do frontend
export const chat = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Você deve estar autenticado.');
    }
    const { query, documentId } = request.data;
    const userId = request.auth.uid;

    // Executa o flow do Genkit para RAG
    const response = await run(ragChat, { query, documentId, userId });

    return { response };
});

// Função de Sumarização: Acionada por uma chamada do frontend
export const summarize = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Você deve estar autenticado.');
    }
    const { documentId } = request.data;

    // Executa o flow do Genkit para extrair o resumo
    const summary = await run(extractSummary, { documentId });

    // Salva o resumo no Firestore
    await db.doc(`documents/${documentId}`).update({ summary });

    return { summary };
});
```

#### 2.3.2. Implantação e Variáveis de Ambiente

*   **Implantação:** `firebase deploy --only functions`
*   **Variáveis de Ambiente:**
    *   `RAW_PDF_BUCKET`: O nome do seu bucket do Cloud Storage.
    *   `GCLOUD_PROJECT`: O ID do seu projeto no Google Cloud.
    *   Você pode definir essas variáveis no `functions/.env` ou usando o comando `firebase functions:config:set`.

---

## 3. Integração com Google Cloud AI e Genkit

### 3.1. Configuração de Credenciais de Serviço

1.  **Crie uma Conta de Serviço:**
    *   No Google Cloud Console, vá para "IAM e administração" > "Contas de serviço".
    *   Clique em "Criar conta de serviço".
    *   Dê um nome à conta (e.g., `processai-functions-runner`).
2.  **Atribua Papéis:**
    *   Atribua os seguintes papéis à sua conta de serviço:
        *   `Cloud Functions Invoker`
        *   `Vertex AI User`
        *   `Cloud Vision AI User`
        *   `Firebase Admin`
3.  **Gere uma Chave JSON:**
    *   Crie uma chave para a conta de serviço e baixe o arquivo JSON. **Guarde este arquivo em um local seguro.**

### 3.2. Inicialização do Genkit

*   No seu código das Cloud Functions (ou em um arquivo `genkit.ts` separado), inicialize o Genkit e configure os plugins do Google AI.

```typescript
import { configureGenkit } from '@genkit-ai/core';
import { googleAI } from '@genkit-ai/googleai';

configureGenkit({
  plugins: [
    googleAI({
      // A API Key é opcional se você estiver rodando em um ambiente Google Cloud
      // com as permissões corretas (Application Default Credentials).
    }),
  ],
  logLevel: 'debug',
  enableTracingAndMetrics: true,
});
```

### 3.3. Configuração do Vertex AI Vector Search

O Vertex AI Vector Search é o coração da sua funcionalidade de RAG, permitindo buscas de similaridade em alta velocidade.

1.  **Crie um Índice (Index):**
    *   No Google Cloud Console, navegue até "Vertex AI" > "Vector Search".
    *   Clique em "Criar Índice".
    *   **Nome do Índice:** Dê um nome descritivo (e.g., `processai-document-embeddings`).
    *   **Dimensões:** **768** (esta é a dimensão do modelo `text-embedding-004`).
    *   **Tipo de Índice:** Selecione `Batch update` (para atualizações em massa) ou `Streaming update` (para atualizações em tempo real). Para começar, `Batch update` é mais simples.
    *   **Distância:** `Dot product` ou `Cosine` são recomendadas para embeddings do `text-embedding-004`.

2.  **Crie um Endpoint de Índice (Index Endpoint):**
    *   Depois que o índice for criado, você precisa implantá-lo em um endpoint para poder fazer consultas.
    *   Na página do seu índice, clique em "Implantar em um endpoint".
    *   Crie um novo endpoint ou selecione um existente.
    *   **Aguarde a implantação, o que pode levar vários minutos.**

3.  **Interaja com o Vector Search a partir do Genkit:**
    *   Atualmente, o Genkit não possui um plugin nativo para o Vertex AI Vector Search. Você precisará usar a biblioteca de cliente do Google Cloud AI Platform.
    *   **Instale a biblioteca:**
        ```bash
        npm install @google-cloud/aiplatform
        ```
    *   **Exemplo de código para busca de similaridade (dentro de um flow do Genkit):**
        ```typescript
        import { aiplatform } from '@google-cloud/aiplatform';

        const { IndexEndpointServiceClient } = aiplatform.v1;
        const client = new IndexEndpointServiceClient({
            apiEndpoint: 'us-central1-aiplatform.googleapis.com' // Use a sua região
        });

        async function findSimilarChunks(queryEmbedding: number[]) {
            const request = {
                indexEndpoint: `projects/${process.env.GCLOUD_PROJECT}/locations/us-central1/indexEndpoints/<SEU_ENDPOINT_ID>`,
                queries: [{
                    vector: {
                        values: queryEmbedding,
                    },
                    neighborCount: 5, // Quantos chunks retornar
                }],
            };

            const [response] = await client.findNeighbors(request);
            // Processe a resposta para extrair os IDs dos chunks
            return response.nearestNeighbors?.[0].neighbors;
        }
        ```

---

## 4. Estrutura de Projeto Sugerida

```
/
├── functions/
│   ├── src/
│   │   ├── index.ts
│   │   └── genkit-flows/
│   │       ├── create-document-embeddings.ts
│   │       └── extract-summary-from-pdf.ts
│   ├── package.json
│   └── tsconfig.json
├── src/
│   ├── app/
│   ├── components/
│   ├── lib/
│   │   └── firebase.ts
│   └── ...
├── .firebaserc
├── firebase.json
└── ...
```

---

## 5. Considerações de Segurança

*   **Proteja Suas Chaves:** Nunca exponha chaves de API ou arquivos de credenciais no seu código do frontend. Use as Cloud Functions como um backend seguro para interagir com os serviços do Google Cloud.
*   **Firebase Authentication:** Use o Firebase Authentication para gerenciar o login dos usuários e proteger suas rotas e dados.
*   **Regras de Segurança:** Implemente regras de segurança detalhadas no Firestore e no Cloud Storage para garantir que os usuários só possam acessar seus próprios dados.

---

## 6. Comandos Essenciais do Firebase CLI

A Firebase CLI é sua principal ferramenta para gerenciar e implantar o projeto.

*   **Login e Inicialização:**
    *   `firebase login`: Autentica você na sua conta do Firebase.
    *   `firebase init`: Inicia um novo projeto Firebase no seu diretório local. Selecione "Functions", "Firestore", "Storage" e "Hosting" (se for hospedar o Next.js no Firebase).
    *   `firebase use <project_id>`: Define qual projeto Firebase você está usando.

*   **Implantação (Deploy):**
    *   `firebase deploy`: Implanta todos os recursos configurados.
    *   `firebase deploy --only functions`: Implanta apenas as Cloud Functions. É útil para atualizações rápidas do backend.
    *   `firebase deploy --only firestore:rules`: Implanta apenas as regras de segurança do Firestore.
    *   `firebase deploy --only storage:rules`: Implanta apenas as regras de segurança do Cloud Storage.
    *   `firebase deploy --only hosting`: Implanta seu site (Next.js).

*   **Gerenciamento de Configuração (Variáveis de Ambiente):**
    *   `firebase functions:config:set mykey="myvalue"`: Define uma variável de ambiente para as Cloud Functions.
    *   `firebase functions:config:get`: Visualiza as variáveis de ambiente configuradas.
    *   `firebase functions:config:unset mykey`: Remove uma variável de ambiente.

*   **Emulação e Testes Locais:**
    *   `firebase emulators:start`: Inicia o Firebase Emulator Suite, permitindo que você teste suas funções, Firestore e Storage localmente.
    *   `firebase emulators:start --only functions,firestore`: Inicia apenas os emuladores especificados.

*   **Logs e Debug:**
    *   `firebase functions:log`: Exibe os logs das suas Cloud Functions em tempo real.
    *   `firebase functions:log --only <function_name>`: Filtra os logs para uma função específica.
