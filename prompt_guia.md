# Guia de Contexto para a IA: Aplicação "ProcessAI Firestore Dashboard"

Olá! Você está assumindo o desenvolvimento de uma aplicação Angular já iniciada. O objetivo deste documento é fornecer todo o contexto necessário sobre a arquitetura, estrutura de dados e funcionalidades existentes para que você possa continuar o trabalho de forma eficiente e consistente.

## 1. Objetivo Principal da Aplicação

A aplicação é um painel de controle (dashboard) para visualizar, em tempo real, os resultados de análises de processos que são armazenadas em um banco de dados Firestore. Ela permite que os usuários naveguem por uma lista de processos e vejam os detalhes de cada documento analisado, incluindo o status do processamento (Sucesso ou Falha).

## 2. Estrutura de Dados no Firestore

A aplicação interage com duas coleções principais no Firestore:

### a) `analises_processos`
Armazena o resultado completo e detalhado da análise de cada documento.

- **Estrutura:**
  - `analises_processos` (Coleção)
    - `{id_do_processo}` (Documento)
      - `resultados_pdfs` (Subcoleção)
        - `{nome_do_arquivo.pdf}` (Documento, com campos como `tipoDocumentoGeral`, `ResumoGeralConteudoArquivo`, `documentosMedicosAnexados`, etc.)

### b) `status_processos`
Funciona como uma tabela de controle leve para rastrear rapidamente o status do processamento de cada arquivo.

- **Estrutura:**
  - `status_processos` (Coleção)
    - `{id_do_processo}` (Documento)
      - `documentos` (Subcoleção)
        - `{nome_do_arquivo.pdf}` (Documento, com os campos `status: 'Sucesso' | 'Falha'`, `timestamp`, e `erro?`)

## 3. Arquitetura da Aplicação Angular

A aplicação foi construída seguindo as práticas mais modernas do Angular:

- **Framework**: Angular v18+
- **Padrão de Componentes**: **100% Standalone Components**. Não há `NgModules`.
- **Gerenciamento de Estado**:
  - **Sinais (`Signals`)** são usados para o estado reativo local dos componentes (`input`, `computed`).
  - **RxJS (`Observables`)** e a biblioteca **`@angular/fire`** são usados para gerenciar os fluxos de dados em tempo real do Firestore. A conversão de Observable para Signal é feita com `toSignal`.
- **Templates**: Usa o **controle de fluxo nativo** (`@if`, `@for`, `@switch`).
- **UI/UX**: Utiliza a biblioteca **Angular Material** (`mat-toolbar`, `mat-list`, `mat-card`, `mat-icon`, etc.) para uma interface limpa e responsiva.
- **Change Detection**: Todos os componentes usam `ChangeDetectionStrategy.OnPush`.

## 4. Componentes e Serviços Principais

### a) `FirestoreService` (`src/app/firestore.service.ts`)
Este serviço centraliza toda a comunicação com o Firestore.

- **Métodos Implementados:**
  - `getProcessIds()`: Retorna um `Observable<string[]>` com os IDs de todos os documentos na coleção `analises_processos`.
  - `getProcessDetails(processId: string)`: Retorna um `Observable<ProcessDocument[]>` com os documentos da subcoleção `resultados_pdfs` para um determinado processo.
  - `getProcessStatus(processId: string)`: Retorna um `Observable<Map<string, StatusDocument>>` com os status dos documentos para um processo. O uso de um `Map` é uma otimização para facilitar a combinação dos dados no componente.

### b) `ProcessListComponent` (`src/app/process-list/process-list.component.ts`)
A tela inicial da aplicação.

- **Funcionalidade:** Usa o `FirestoreService` para buscar e exibir a lista de IDs de processo em tempo real. Cada item da lista é um link que navega para a tela de detalhes.

### c) `ProcessDetailComponent` (`src/app/process-detail/process-detail.component.ts`)
A tela de detalhes de um processo específico.

- **Funcionalidade:**
  1.  Recebe o `id` do processo da URL via `input()`.
  2.  Usa o `id` para chamar **dois métodos** do `FirestoreService`: `getProcessDetails` e `getProcessStatus`.
  3.  Usa `combineLatest` do RxJS para aguardar a resposta de ambos os observables.
  4.  Combina os dois conjuntos de dados: para cada documento de análise, ele anexa o objeto de status correspondente.
  5.  Renderiza o resultado em uma série de `mat-card`.
  6.  **Exibe o status (`Sucesso`/`Falha`) de forma proeminente** em cada card, usando cores e ícones (`check_circle` verde / `error` vermelho). Se o status for `Falha`, a mensagem de erro também é exibida.

## 5. Roteamento (`src/app/app.routes.ts`)

- `path: ''` -> Carrega o `ProcessListComponent`.
- `path: 'processes/:id'` -> Carrega o `ProcessDetailComponent`, passando o ID do processo na rota.


========================================================

### Visão Geral da Estrutura de Dados

Seu Firestore terá duas coleções de nível superior, cada uma servindo a um propósito distinto:

1.  **`analises_processos`**: Guarda os dados ricos e completos de cada análise.
2.  **`status_processos`**: Mantém um registro leve do status de cada tarefa.

-----

### 1\. Detalhes do Documento em `analises_processos`

Esta é a coleção mais importante, pois contém o resultado detalhado da análise de IA.

**Caminho no Firestore:**
`analises_processos/{id_do_processo}/resultados_pdfs/{nome_do_arquivo.pdf}`

Um documento individual neste caminho (representando a análise de um único PDF) terá a seguinte estrutura JSON detalhada:

```json
{
  "idDocumento": "ID_ALFANUMERICO_EXTRAIDO", // ID único extraído do conteúdo do documento. Se não encontrado, pode usar o nome do arquivo como fallback.
  "nomeArquivoOriginal": "peticao_inicial.pdf", // O nome exato do arquivo PDF que foi analisado.
  "tipoDocumentoGeral": "Petição Inicial", // A classificação geral do documento, como 'ASO Admissional', 'Contestação', 'Quesitos', etc.
  "poloOrigemDocumento": "Ativo", // Indica quem submeteu o documento: 'Ativo', 'Passivo', 'Neutro', ou 'Não Identificado'.
  "dadosRelevantesParaLaudo": { // Objeto contendo informações gerais cruciais para o laudo.
    "identificacaoDasPartes": "Reclamante: João da Silva (CPF: 123.456.789-00), Reclamada: Empresa XYZ (CNPJ: 11.222.333/0001-44)...", // Nomes, CPFs, CNPJs, e outros dados de identificação.
    "Vara": "1ª Vara Federal da SSJ de Feira de Santana-BA", // A vara específica onde o processo está tramitando.
    "ResumoGeralConteudoArquivo": "A petição inicial descreve a lesão no ombro do reclamante, alegando nexo causal com a atividade laboral...", // Um resumo do conteúdo principal do arquivo focado nos aspectos periciais.
    "historicoClinicoGeral": "Paciente relata hipertensão arterial sistêmica e cirurgia prévia de apendicite...", // Comorbidades, cirurgias e outros dados de saúde mencionados.
  },
  "historicoOcupacional": [ // Uma lista de objetos, cada um representando uma experiência profissional.
      {
        "ocupacaoAtual": "Auxiliar de Produção", // A profissão atual declarada no documento.
        "descricaoFuncao": "Responsável por operar a máquina de embalagem, realizando movimentos repetitivos com os braços.", // Descrição detalhada das atividades e tarefas.
        "ambienteFisico": "Exposição a ruído constante de 85dB e calor.", // Menções a agentes físicos no ambiente de trabalho.
        "ambientePsicossocial": "Relatos de alta pressão para cumprimento de metas.", // Menções a fatores psicossociais.
        "jornadaTrabalho": "Turno de 8 horas, de segunda a sexta, com horas extras aos sábados.", // Informações sobre horários e jornada.
        "treinamentoEPIs": "Declara ter recebido treinamento para uso de protetores auriculares." // Menção ao uso e treinamento de EPIs.
      },
      {
        "ocupacaoAnteriores": "Montador de Móveis", // Uma ocupação anterior.
        "descricaoFuncao": "Realizava a montagem de móveis em residências de clientes.",
        "periodoFuncao":"01/2018 a 12/2020" // Período em que exerceu a função.
      }
  ],
  "documentosMedicosAnexados": [ // Uma lista de objetos, cada um para um documento médico específico encontrado dentro do PDF.
    {
      "tipo": "Laudo de Exame de Ultrassonografia de Ombro", // Tipo específico do documento médico.
      "data": "15/05/2023", // Data de emissão do documento médico.
      "profissionalServico": "Clínica Imagem Diagnósticos / Dr. Carlos Andrade", // Nome do profissional ou instituição.
      "resumoConteudo": "Diagnóstico de tendinopatia do supraespinhal com ruptura parcial. CID: M75.1", // Resumo focado no diagnóstico, achados e conclusões do documento específico.
      "paginaNoArquivo": "42" // A página dentro do arquivo PDF principal onde este anexo pode ser encontrado.
    }
  ],
  "quesitosApresentados": [ // Uma lista para os quesitos encontrados.
    {
      "polo": "Ativo", // Quem apresentou os quesitos.
      "quesito": "Sim", // Simplesmente indica se existem quesitos no documento.
      "paginaNoArquivo": "55" // A página onde os quesitos começam.
    }
  ],
  "observacoes": "A qualidade de digitalização da página 34 está baixa, dificultando a leitura de algumas informações." // Qualquer informação adicional relevante, como dificuldades na análise.
}
```

-----

### 2\. Detalhes do Documento em `status_processos`

Esta coleção serve como um log de execução, sendo crucial para monitorar a saúde do sistema.

**Caminho no Firestore:**
`status_processos/{id_do_processo}/documentos/{nome_do_arquivo.pdf}`

Um documento individual neste caminho é muito mais simples e terá a seguinte estrutura:

**Em caso de sucesso:**

```json
{
  "status": "Sucesso",
  "timestamp": "August 13, 2025 at 1:15:30 PM UTC-3" // Firestore.SERVER_TIMESTAMP
}
```

**Em caso de falha:**

```json
{
  "status": "Falha",
  "erro": "Erro ao processar peticao_inicial.pdf: Falha ao analisar com a API Gemini: O tempo limite da solicitação foi atingido.", // Mensagem de erro capturada pela exceção.
  "timestamp": "August 13, 2025 at 1:16:05 PM UTC-3" // Firestore.SERVER_TIMESTAMP
}
```