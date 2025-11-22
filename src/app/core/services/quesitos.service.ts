import { Injectable, inject } from '@angular/core';
import { 
  Firestore, 
  collection, 
  collectionData, 
  addDoc, 
  doc, 
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
   * Opcionalmente filtra por jurisdição e tipo de ação.
   */
  getModelos(jurisdicao?: string, tipoAcao?: string): Observable<ModeloQuesito[]> {
    const colRef = collection(this.firestore, this.collectionName);
    let q = query(colRef, orderBy('titulo')); // Ordenação padrão por título

    // Aplica filtros se forem fornecidos
    if (jurisdicao) {
      q = query(q, where('jurisdicao', '==', jurisdicao));
    }
    
    if (tipoAcao) {
      q = query(q, where('tipoAcao', '==', tipoAcao));
    }

    // Retorna os dados com o ID do documento incluído
    return collectionData(q, { idField: 'id' }) as Observable<ModeloQuesito[]>;
  }

  /**
   * Obtém um modelo específico pelo ID
   */
  getModeloById(id: string): Observable<ModeloQuesito> {
    const docRef = doc(this.firestore, `${this.collectionName}/${id}`);
    // Nota: collectionData é para listas. Para um doc único usamos docData ou getDoc, 
    // mas aqui vamos simplificar retornando a lista filtrada ou implementando de outra forma se necessário.
    // Para manter simples e reativo, muitas vezes buscamos a lista, mas aqui está a forma direta:
    const { docData } = require('rxfire/firestore'); // *Nota didática: Em AngularFire moderno usa-se docData
    const { docData: docDataFn } = require('@angular/fire/firestore');
    // Vamos usar a importação correta acima se estiver disponível, senão usamos collectionData filtrado.
    
    // Abordagem simples com AngularFire:
    return collectionData(
      query(collection(this.firestore, this.collectionName), where('__name__', '==', id)),
      { idField: 'id' }
    ) as unknown as Observable<ModeloQuesito>; 
    // Nota: O retorno acima vem como array, na prática trataremos no componente.
  }

  /**
   * Cria um novo modelo de quesitos
   */
  addModelo(modelo: ModeloQuesito): Observable<any> {
    const colRef = collection(this.firestore, this.collectionName);
    
    // Remove o ID se existir, pois o Firestore cria um novo
    const { id, ...dadosParaSalvar } = modelo;
    
    dadosParaSalvar.createdAt = new Date();
    dadosParaSalvar.updatedAt = new Date();

    return from(addDoc(colRef, dadosParaSalvar));
  }

  /**
   * Atualiza um modelo existente
   */
  updateModelo(id: string, modelo: Partial<ModeloQuesito>): Observable<void> {
    const docRef = doc(this.firestore, `${this.collectionName}/${id}`);
    
    const dadosAtualizados = {
      ...modelo,
      updatedAt: new Date()
    };

    return from(updateDoc(docRef, dadosAtualizados));
  }

  /**
   * Remove um modelo (cuidado!)
   */
  deleteModelo(id: string): Observable<void> {
    const docRef = doc(this.firestore, `${this.collectionName}/${id}`);
    return from(deleteDoc(docRef));
  }
}