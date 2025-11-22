import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  docData,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  serverTimestamp
} from '@angular/fire/firestore';
import { Observable, from } from 'rxjs';
import { Persona } from '../models/persona.model';

@Injectable({
  providedIn: 'root'
})
export class PersonasService {
  private firestore = inject(Firestore);
  private collectionName = 'personas';

  /**
   * Retorna todas as personas cadastradas (ordenadas por nome).
   * Pode filtrar apenas as ativas se necessario.
   */
  getPersonas(apenasAtivas: boolean = false): Observable<Persona[]> {
    const colRef = collection(this.firestore, this.collectionName);
    
    let q;
    if (apenasAtivas) {
      q = query(colRef, where('ativo', '==', true), orderBy('nome'));
    } else {
      q = query(colRef, orderBy('nome'));
    }

    return collectionData(q, { idField: 'id' }) as Observable<Persona[]>;
  }

  /**
   * Busca uma persona específica pelo ID
   */
  getPersonaById(id: string): Observable<Persona | undefined> {
    const docRef = doc(this.firestore, `${this.collectionName}/${id}`);
    return docData(docRef, { idField: 'id' }) as Observable<Persona>;
  }

  /**
   * Cria uma nova Persona
   */
  createPersona(persona: Partial<Persona>): Observable<string> {
    const colRef = collection(this.firestore, this.collectionName);
    
    const novaPersona = {
      ...persona,
      ativo: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    // from() converte a Promise do Firestore em Observable
    return from(addDoc(colRef, novaPersona).then(ref => ref.id));
  }

  /**
   * Atualiza uma Persona existente
   */
  updatePersona(id: string, persona: Partial<Persona>): Observable<void> {
    const docRef = doc(this.firestore, `${this.collectionName}/${id}`);
    
    const dadosAtualizados = {
      ...persona,
      updatedAt: serverTimestamp()
    };

    return from(updateDoc(docRef, dadosAtualizados));
  }

  /**
   * Exclusão física (Cuidado: remove permanentemente)
   */
  deletePersona(id: string): Observable<void> {
    const docRef = doc(this.firestore, `${this.collectionName}/${id}`);
    return from(deleteDoc(docRef));
  }

  /**
   * Alterna o status ativo/inativo (Soft Delete)
   */
  toggleStatus(id: string, statusAtual: boolean): Observable<void> {
    const docRef = doc(this.firestore, `${this.collectionName}/${id}`);
    return from(updateDoc(docRef, { 
      ativo: !statusAtual,
      updatedAt: serverTimestamp() 
    }));
  }
}