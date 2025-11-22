export interface QuesitoItem {
    id: string;             // Identificador único do quesito dentro da lista
    texto: string;          // A pergunta do quesito
    respostaPadrao: string; // O texto sugerido para resposta
    ordem: number;          // Para controlar a posição na lista
  }
  
  export interface ModeloQuesito {
    id?: string;            // ID do documento no Firestore
    jurisdicao: string;     // Ex: 'Salvador', 'Feira de Santana'
    tipoAcao: 'IL' | 'LOAS' | 'Outros'; // Tipo do processo
    titulo: string;         // Nome amigável para identificar o modelo
    ativo: boolean;         // Se este modelo está disponível para uso
    itens: QuesitoItem[];   // A lista de perguntas e respostas
    createdAt?: Date;
    updatedAt?: Date;
  }