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

## Fase 3: Monitoramento de Status

**Objetivo:** Integrar os dados de status da coleção `status_processos` na tela de detalhes, permitindo ao usuário ver o resultado (`Sucesso`/`Falha`) do processamento de cada documento.

**Passos:**

1.  **Expandir `FirestoreService`**:
    - Criar uma nova interface, `StatusDocument`.
    - Adicionar um novo método, `getProcessStatus(processId: string)`, que buscará os documentos da subcoleção `status_processos/{processId}/documentos`.
    - O método retornará um `Observable<Map<string, StatusDocument>>` para otimizar a consulta.
2.  **Atualizar `ProcessDetailComponent`**:
    - Chamar o novo método `getProcessStatus`.
    - Criar um sinal computado (`computed`) que irá combinar os resultados das duas fontes de dados: os detalhes da análise e o status do processamento.
    - O novo sinal conterá uma lista de documentos de análise, cada um enriquecido com seu status correspondente.
3.  **Atualizar o Template**:
    - Modificar o `mat-card` para exibir o status de forma proeminente.
    - Usar `mat-icon` e cores para uma representação visual clara: um ícone de "check" verde para Sucesso e um de "erro" vermelho para Falha.
    - Exibir a mensagem de erro (`erro`) se o status for 'Falha'.
    - Importar o `MatIconModule` no componente.
4.  **Verificar e Corrigir**: Executar `ng build` para garantir que não há erros de compilação.
