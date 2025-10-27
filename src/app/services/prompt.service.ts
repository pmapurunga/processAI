
import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, doc, setDoc, deleteDoc } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

// Interface restaurada para o estado original
export interface Prompt {
  id: string;
  nome: string;
  descricao: string;
  texto: string; 
}

@Injectable({
  providedIn: 'root'
})
export class PromptService {
  private firestore: Firestore = inject(Firestore);
  private promptsCollection = collection(this.firestore, 'prompts');

  constructor() { }

  getPrompts(): Observable<Prompt[]> {
    return collectionData(this.promptsCollection, { idField: 'id' }) as Observable<Prompt[]>;
  }

  savePrompt(prompt: Prompt): Observable<void> {
    const docRef = doc(this.promptsCollection, prompt.id || doc(collection(this.firestore, '_')).id);
    return new Observable(observer => {
      setDoc(docRef, prompt, { merge: true })
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
