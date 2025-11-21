import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, doc, setDoc, deleteDoc, docData } from '@angular/fire/firestore'; // Adicionado docData
import { Observable } from 'rxjs';

export interface Prompt {
  id: string;
  nome: string;
  prompt_text: string;
}

@Injectable({
  providedIn: 'root'
})
export class PromptService {
  private firestore: Firestore = inject(Firestore);
  private promptsCollection = collection(this.firestore, 'configuracoes_prompts');

  constructor() { }

  getPrompts(): Observable<Prompt[]> {
    return collectionData(this.promptsCollection, { idField: 'id' }) as Observable<Prompt[]>;
  }

  // NOVO MÉTODO: Busca um prompt específico pelo ID
  getPromptById(id: string): Observable<Prompt | undefined> {
    const docRef = doc(this.promptsCollection, id);
    return docData(docRef, { idField: 'id' }) as Observable<Prompt | undefined>;
  }

  savePrompt(prompt: Prompt): Observable<void> {
    const docId = prompt.id || doc(collection(this.firestore, '_')).id;
    const docRef = doc(this.promptsCollection, docId);
    
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