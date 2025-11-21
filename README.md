# ProcessAI

**ProcessAI** é uma aplicação web desenvolvida em **Angular** projetada para auxiliar na gestão e análise de processos judiciais. O sistema foca na otimização de tarefas como análise de documentos médicos, avaliações periciais e geração de laudos, integrando funcionalidades de inteligência artificial e gestão documental.

## 🚀 Funcionalidades Principais

* **Autenticação Segura:** Login integrado com Google (Firebase Authentication).
* **Gestão de Processos:** Listagem, seleção e gerenciamento de detalhes de processos.
* **Análise de Documentos:** Upload e visualização de documentos (PDFs) com foco em documentos médicos.
* **Perícia Digital:**
    * Avaliação Pericial detalhada.
    * Geração e visualização de Laudos Periciais.
* **Gestão de Prompts:** Interface para configurar e testar prompts utilizados na análise de IA.
* **Diretrizes:** Área para configuração de diretrizes de análise.

## 🛠 Tecnologias Utilizadas

O projeto utiliza uma stack moderna baseada no ecossistema Angular e Google Firebase:

* **Frontend:** [Angular](https://angular.io/) (v19+)
    * Arquitetura baseada em **Standalone Components**.
    * **Angular Material** para componentes de UI (botões, inputs, tabelas, dialogs).
    * **RxJS** para programação reativa.
* **Backend & Infraestrutura:** [Firebase](https://firebase.google.com/)
    * **Authentication:** Gestão de usuários.
    * **Firestore:** Banco de dados NoSQL em tempo real.
    * **Storage:** Armazenamento de arquivos (PDFs e anexos).
    * **Cloud Functions:** (Opcional) Lógica de servidor serverless.
* **Estilização:** SCSS e CSS customizados com tema do Angular Material.

## 📋 Pré-requisitos

Antes de começar, certifique-se de ter instalado em sua máquina:

* [Node.js](https://nodejs.org/) (Versão LTS recomendada, v18 ou superior)
* [Angular CLI](https://angular.io/cli): Instale globalmente com `npm install -g @angular/cli`

## 🔧 Instalação e Configuração

1.  **Clone o repositório:**
    ```bash
    git clone [https://github.com/seu-usuario/process-ai.git](https://github.com/seu-usuario/process-ai.git)
    cd process-ai
    ```

2.  **Instale as dependências:**
    ```bash
    npm install
    ```

3.  **Configuração do Firebase:**
    O projeto depende das credenciais do Firebase.
    * Crie um projeto no console do Firebase.
    * Copie as configurações do seu app web (apiKey, authDomain, etc.).
    * Atualize o arquivo `src/environments/environment.ts` (e `environment.prod.ts`):

    ```typescript
    export const environment = {
      production: false,
      firebaseConfig: {
        apiKey: "SUA_API_KEY",
        authDomain: "SEU_PROJETO.firebaseapp.com",
        projectId: "SEU_PROJECT_ID",
        storageBucket: "SEU_PROJETO.firebasestorage.app",
        messagingSenderId: "SEU_SENDER_ID",
        appId: "SEU_APP_ID"
      }
    };
    ```

4.  **Execute o servidor de desenvolvimento:**
    ```bash
    ng serve
    ```
    Acesse a aplicação em `http://localhost:4200/`.

## 📂 Estrutura do Projeto

A estrutura segue as boas práticas do Angular moderno:

```text
src/
├── app/
│   ├── layout/          # Estrutura base (Sidebar, Header)
│   ├── login/           # Tela de Login
│   ├── models/          # Interfaces e Tipos (TypeScript)
│   ├── pages/           # Páginas principais (Lista, Detalhes, Laudos)
│   ├── services/        # Serviços de API e Regras de Negócio (Firebase)
│   ├── app.routes.ts    # Configuração de rotas
│   └── app.config.ts    # Configuração global (Providers)
├── assets/              # Imagens e recursos estáticos
└── environments/        # Configurações de ambiente (Firebase Keys)