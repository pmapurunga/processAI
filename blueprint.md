# ProcessAI Firestore Dashboard

## Visão Geral

Uma aplicação web em Angular moderna e de alto desempenho para visualizar os resultados de análises de processos armazenados no Firestore. A aplicação utiliza AngularFire para conectividade em tempo real, garantindo que os dados exibidos estejam sempre atualizados. A interface é construída com Angular Material, seguindo um design limpo, responsivo e intuitivo.

## Arquitetura e Estilo

- **Framework**: Angular (Standalone Components, Signals, Control Flow nativo)
- **UI**: Angular Material
- **State Management**: Signals para o estado local e `async` pipe com Observables do AngularFire para dados do backend.
- **Design**:
    - **Cores**: Uma paleta baseada em tons de azul e cinza para uma aparência profissional e moderna.
    - **Tipografia**: Uso de fontes claras e legíveis (Roboto, padrão do Angular Material).
    - **Layout**: Responsivo, utilizando `mat-toolbar`, `mat-list`, e `mat-card` para uma estrutura organizada e de fácil navegação.
    - **Iconografia**: Ícones do Material Design para melhorar a usabilidade e a compreensão visual.

---

# Plano de Implementação Atual

## Fase 4: Correção e Melhoria na Exclusão de Processos

**Objetivo:** Garantir a exclusão completa dos dados do processo, incluindo arquivos no Firebase Storage que podem estar armazenados com caminhos personalizados ou fora da estrutura de pastas padrão.

**Passos:**

1.  **Refatorar `ProcessService.deleteProcess`**:
    - Modificar a lógica de exclusão para primeiro recuperar os documentos do processo (`getDocumentosAnalisados`).
    - Iterar sobre os documentos para extrair os caminhos reais dos arquivos PDF (`linkArquivoPDF`) usando decodificação de URL do Storage.
2.  **Executar Exclusão Robusta no Storage**:
    - Criar uma lista de promessas para apagar os arquivos identificados especificamente.
    - Manter a tentativa de apagar a pasta raiz do processo (`processId/`) recursivamente como fallback.
    - Executar todas as exclusões de Storage em paralelo.
3.  **Sincronizar com Firestore**:
    - Garantir que a exclusão dos dados no Firestore (`analises_processos` e `status_processos`) ocorra em conjunto (forkJoin) com a limpeza do Storage.
4.  **Verificar e Corrigir**:
    - O código foi atualizado para lidar com erros silenciosos (ex: arquivo não encontrado) para não bloquear o fluxo de exclusão.
    - `ng build` executado com sucesso.
