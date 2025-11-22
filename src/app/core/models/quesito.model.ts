export interface QuesitoItem {
  id: string;
  texto: string;
  respostaPadrao: string;
  ordem: number;
}

export interface ModeloQuesito {
  id?: string;
  jurisdicao: string;
  tipoAcao: 'IL' | 'LOAS' | string;
  titulo: string;
  ativo: boolean;
  quesitos: QuesitoItem[]; // <-- Mudamos de 'itens' para 'quesitos'
  createdAt?: any;
  updatedAt?: any;
}