import { Injectable, inject } from '@angular/core';
// 1. ADICIONE 'addDoc' e 'serverTimestamp' AQUI:
import { Firestore, collection, doc, getDoc, getDocs, collectionData, deleteDoc, updateDoc, addDoc, serverTimestamp, increment, query, where, orderBy } from '@angular/fire/firestore';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class FirestoreService {
  private firestore = inject(Firestore);

  getLaudoPericial(numero_processo: string): Observable<any> {
    const docRef = doc(this.firestore, `analises_processos/${numero_processo}/pericia/laudo_pericial`);
    return from(getDoc(docRef)).pipe(
      map(docSnap => docSnap.exists() ? docSnap.data() : null)
    );
  }

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
      // Usamos o 'from' para converter a Promise do nosso método manual em Observable
      return from(this.performDeepDelete(processId));
    }

    /**
     * Apaga subcoleções conhecidas e documentos aninhados manualmente,
     * pois o Firestore não faz exclusão em cascata (Deep Delete) nativamente.
     */
    private async performDeepDelete(id: string): Promise<void> {
      // 1. Apagar documentos específicos da subcoleção 'pericia'
      // Baseado no seu código, existem documentos fixos dentro de 'pericia'
      const docsPericia = ['laudo_pericial', 'avaliacao_pericial', 'documentos_consolidados'];

      const periciaPromises = docsPericia.map(docNome => {
        const docRef = doc(this.firestore, `analises_processos/${id}/pericia/${docNome}`);
        return deleteDoc(docRef);
      });

      // 2. Apagar todos os documentos da subcoleção 'documentos_analisados'
      // Como os IDs aqui são dinâmicos, precisamos listar (getDocs) primeiro
      const docsAnalisadosRef = collection(this.firestore, `analises_processos/${id}/documentos_analisados`);
      const snapshot = await getDocs(docsAnalisadosRef);

      const docsAnalisadosPromises = snapshot.docs.map(docSnap => deleteDoc(docSnap.ref));

      // Aguarda que todas as sub-exclusões terminem
      await Promise.all([...periciaPromises, ...docsAnalisadosPromises]);

      // 3. Finalmente, apaga o documento principal do processo
      const mainDocRef = doc(this.firestore, `analises_processos/${id}`);
      await deleteDoc(mainDocRef);
    }

  deleteProcessStatus(processId: string): Observable<void> {
    const docRef = doc(this.firestore, `status_processos/${processId}`);
    return from(deleteDoc(docRef));
  }





  // -----------------------------------------------------------------------
  // 2. NOVO MÉTODO: Log de Tokens (Adicione este bloco no final da classe)
  // -----------------------------------------------------------------------
  async logTokenUsage(logData: {
    processId: string;
    inputTokens: number;
    outputTokens: number;
    model: string;
    actionContext: string;
  }): Promise<void> {
    const logsCollection = collection(this.firestore, 'ai_usage_logs');

    // 1. Salva o Log Detalhado (Histórico)
    await addDoc(logsCollection, {
      ...logData,
      totalTokens: logData.inputTokens + logData.outputTokens,
      timestamp: serverTimestamp()
    });

    // 2. Atualiza o Contador no Processo (Para visualização rápida no Selector)
    const processRef = doc(this.firestore, `analises_processos/${logData.processId}`);

    // Usamos 'updateDoc' com 'increment' para somar atomicamente (seguro contra concorrência)
    // O catch é para evitar erro caso o processo tenha sido deletado enquanto a IA respondia
    await updateDoc(processRef, {
      'usoIA.totalInput': increment(logData.inputTokens),
      'usoIA.totalOutput': increment(logData.outputTokens),
      'usoIA.custoTotal': increment(logData.inputTokens + logData.outputTokens),
      'usoIA.ultimaAtualizacao': serverTimestamp()
    }).catch(err => console.warn('Não foi possível atualizar contador do processo (pode ter sido excluído):', err));
  }

  getAiLogsByProcessId(processId: string): Observable<any[]> {
    const logsCollection = collection(this.firestore, 'ai_usage_logs');

    // Cria a query: "Procure na coleção onde processId == X e ordene por data decrescente"
    const q = query(
      logsCollection,
      where('processId', '==', processId),
      orderBy('timestamp', 'desc')
    );

    return collectionData(q, { idField: 'id' });
  }

}
