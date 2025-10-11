import { Injectable, inject } from '@angular/core';
import { Firestore, collection, onSnapshot, QuerySnapshot, DocumentData, doc, setDoc, deleteDoc } from '@angular/fire/firestore';
import { Observable, from } from 'rxjs';

export interface Prompt {
  id: string;
  nome: string; 
  prompt_text: string;
}

@Injectable({
  providedIn: 'root'
})
export class PromptService {
  private firestore = inject(Firestore);
  private promptsCollection = collection(this.firestore, 'configuracoes_prompts');

  getPrompts(): Observable<Prompt[]> {
    return new Observable(subscriber => {
      const unsubscribe = onSnapshot(this.promptsCollection, (snapshot: QuerySnapshot<DocumentData>) => {
        const prompts: Prompt[] = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            nome: data['nome'] || doc.id, // Fallback para o ID se o nome não existir
            prompt_text: data['prompt_text'] || ''
          };
        });
        subscriber.next(prompts);
      }, (error) => {
        console.error("Error fetching prompts: ", error);
        subscriber.error(error);
      });
      
      return () => unsubscribe();
    });
  }

  savePrompt(prompt: Prompt): Observable<void> {
    const promptDoc = doc(this.firestore, 'configuracoes_prompts', prompt.id);
    return from(setDoc(promptDoc, { nome: prompt.nome, prompt_text: prompt.prompt_text }, { merge: true }));
  }

  deletePrompt(id: string): Observable<void> {
    const promptDoc = doc(this.firestore, 'configuracoes_prompts', id);
    return from(deleteDoc(promptDoc));
  }
}
