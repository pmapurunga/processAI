import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, addDoc, deleteDoc, doc } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

export interface Diretriz {
  id?: string;
  nome: string;
  justica: 'Justiça Comum' | 'Justiça do Trabalho' | 'Justiça Federal';
  link: string;
  conteudo?: string; // <--- ADICIONADO: Corrige o erro Property 'conteudo' does not exist
}

@Injectable({
  providedIn: 'root'
})
export class DiretrizesService {
  private firestore: Firestore = inject(Firestore);
  private collectionPath = 'diretrizes'; 
  private diretrizesCollection = collection(this.firestore, this.collectionPath);

  constructor() { }

  // Obter todas as diretrizes (com ID)
  getDiretrizes(): Observable<Diretriz[]> {
    return collectionData(this.diretrizesCollection, { idField: 'id' }) as Observable<Diretriz[]>;
  }

  // Criar nova diretriz
  addDiretriz(diretriz: Diretriz): Promise<any> {
    // Removemos o ID se existir, pois o Firestore cria um novo
    const { id, ...data } = diretriz; 
    return addDoc(this.diretrizesCollection, data);
  }

  // Apagar diretriz
  deleteDiretriz(id: string): Promise<void> {
    const docRef = doc(this.firestore, `${this.collectionPath}/${id}`);
    return deleteDoc(docRef);
  }
}