import { Injectable, inject } from '@angular/core';
import { Firestore, collection, doc, getDoc, collectionData, deleteDoc, updateDoc } from '@angular/fire/firestore';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class FirestoreService {
  private firestore = inject(Firestore);

  getLaudoPericial(numero_processo: string): Observable<any> {
    // Caminho para ler o laudo
    const docRef = doc(this.firestore, `analises_processos/${numero_processo}/pericia/laudo_pericial`);
    return from(getDoc(docRef)).pipe(
      map(docSnap => docSnap.exists() ? docSnap.data() : null)
    );
  }

  // NOVO MÉTODO: Atualiza campos do laudo (usado para salvar a análise da IA)
  updateLaudoPericial(numero_processo: string, data: any): Promise<void> {
    const docRef = doc(this.firestore, `analises_processos/${numero_processo}/pericia/laudo_pericial`);
    return updateDoc(docRef, data);
  }

  getProcessos(): Observable<any[]> {
    const collectionRef = collection(this.firestore, 'analises_processos');
    return collectionData(collectionRef, { idField: 'id' });
  }

  getProcesso(id: string): Observable<any> {
    const docRef = doc(this.firestore, `analises_processos/${id}`);
    return from(getDoc(docRef)).pipe(
      map(docSnap => docSnap.exists() ? docSnap.data() : null)
    );
  }

  getDocumentosAnalisados(processoId: string): Observable<any[]> {
    const collectionRef = collection(this.firestore, `analises_processos/${processoId}/documentos_analisados`);
    return collectionData(collectionRef, { idField: 'id' });
  }

  getAvaliacaoPericial(numero_processo: string): Observable<any> {
    const docRef = doc(this.firestore, `analises_processos/${numero_processo}/pericia/avaliacao_pericial`);
    return from(getDoc(docRef)).pipe(
      map(docSnap => docSnap.exists() ? docSnap.data() : null)
    );
  }

  getDocumentosConsolidados(numero_processo: string): Observable<any> {
    const docRef = doc(this.firestore, `analises_processos/${numero_processo}/pericia/documentos_consolidados`);
    return from(getDoc(docRef)).pipe(
      map(docSnap => docSnap.exists() ? docSnap.data() : null)
    );
  }

  deleteProcess(processId: string): Observable<void> {
    const docRef = doc(this.firestore, `analises_processos/${processId}`);
    return from(deleteDoc(docRef));
  }

  deleteProcessStatus(processId: string): Observable<void> {
    const docRef = doc(this.firestore, `status_processos/${processId}`);
    return from(deleteDoc(docRef));
  }
}