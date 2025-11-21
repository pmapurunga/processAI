import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, doc, setDoc, deleteDoc } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

// Ajustamos a interface para refletir os campos REAIS do seu banco de dados
export interface Prompt {
  id: string;
  nome: string;
  prompt_text: string; // Antes era 'texto', agora corrigido
  // Removi 'descricao' pois você disse que o banco só tem id, nome e prompt_text
}

@Injectable({
  providedIn: 'root'
})
export class PromptService {
  private firestore: Firestore = inject(Firestore);
  
  // Apontando para a coleção correta
  // Assumindo que 'configuracoes_prompts' é a coleção e 'pericia_federal' será um dos documentos nela
  private promptsCollection = collection(this.firestore, 'configuracoes_prompts');

  constructor() { }

  getPrompts(): Observable<Prompt[]> {
    return collectionData(this.promptsCollection, { idField: 'id' }) as Observable<Prompt[]>;
  }

  savePrompt(prompt: Prompt): Observable<void> {
    // Se tiver ID usa ele, se não, gera um novo ID automático
    const docId = prompt.id || doc(collection(this.firestore, '_')).id;
    const docRef = doc(this.promptsCollection, docId);
    
    // Criamos o objeto payload garantindo que os campos batem com o Firestore
    const payload = {
      nome: prompt.nome,
      prompt_text: prompt.prompt_text
    };

    return new Observable(observer => {
      setDoc(docRef, payload, { merge: true })
        .then(() => {
          observer.next();
          observer.complete();
        })
        .catch(error => observer.error(error));
    });
  }

  deletePrompt(id: string): Observable<void> {
    const docRef = doc(this.promptsCollection, id);
    return new Observable(observer => {
      deleteDoc(docRef)
        .then(() => {
          observer.next();
          observer.complete();
        })
        .catch(error => observer.error(error));
    });
  }
}