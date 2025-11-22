import { Injectable, inject } from '@angular/core';
import { 
  Firestore, 
  collection, 
  collectionData, 
  doc,
  docData, // <--- Importação correta
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  orderBy
} from '@angular/fire/firestore';
import { Observable, from } from 'rxjs';
import { ModeloQuesito } from '../models/quesito.model';

@Injectable({
  providedIn: 'root'
})
export class QuesitosService {
  private firestore = inject(Firestore);
  private readonly collectionName = 'modelos-quesitos';

  /**
   * Obtém todos os modelos de quesitos.
   */
  getModelos(jurisdicao?: string, tipoAcao?: string): Observable<ModeloQuesito[]> {
    const colRef = collection(this.firestore, this.collectionName);
    let q = query(colRef, orderBy('titulo'));

    if (jurisdicao) {
      q = query(q, where('jurisdicao', '==', jurisdicao));
    }
    
    if (tipoAcao) {
      q = query(q, where('tipoAcao', '==', tipoAcao));
    }

    return collectionData(q, { idField: 'id' }) as Observable<ModeloQuesito[]>;
  }

  /**
   * Obtém um modelo específico pelo ID
   */
  getModeloById(id: string): Observable<ModeloQuesito> {
    const docRef = doc(this.firestore, `${this.collectionName}/${id}`);
    // Agora usamos a função correta do AngularFire
    return docData(docRef, { idField: 'id' }) as Observable<ModeloQuesito>;
  }

  addModelo(modelo: ModeloQuesito): Observable<any> {
    const colRef = collection(this.firestore, this.collectionName);
    const { id, ...dadosParaSalvar } = modelo;
    
    dadosParaSalvar.createdAt = new Date();
    dadosParaSalvar.updatedAt = new Date();

    return from(addDoc(colRef, dadosParaSalvar));
  }

  updateModelo(id: string, modelo: Partial<ModeloQuesito>): Observable<void> {
    const docRef = doc(this.firestore, `${this.collectionName}/${id}`);
    const dadosAtualizados = {
      ...modelo,
      updatedAt: new Date()
    };
    return from(updateDoc(docRef, dadosAtualizados));
  }

  deleteModelo(id: string): Observable<void> {
    const docRef = doc(this.firestore, `${this.collectionName}/${id}`);
    return from(deleteDoc(docRef));
  }
}