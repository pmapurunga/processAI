import { Timestamp } from '@angular/fire/firestore';

export interface ConhecimentoItem {
  titulo: string;
  conteudo: string;
}

export interface Persona {
  id?: string;
  nome: string;
  instrucoes: string; // Equivalente ao System Instruction
  conhecimentos: ConhecimentoItem[]; // Lista de textos de referência
  ativo: boolean; // Para arquivar sem deletar
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}