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
  quesitos: QuesitoItem[];
  
  // Campo novo para armazenar o prompt específico da IA
  promptIA?: string;
  
  createdAt?: any;
  updatedAt?: any;
}