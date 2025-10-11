
import { inject, Injectable } from '@angular/core';
import { forkJoin, map, Observable, from } from 'rxjs';
import { Processo } from '../models/process.model';
import { FirestoreService } from '../firestore.service';
import { Storage, ref, deleteObject, listAll } from '@angular/fire/storage';

@Injectable({
  providedIn: 'root',
})
export class ProcessService {
  private firestoreService = inject(FirestoreService);
  private storage = inject(Storage);

  getProcess(processId: string): Observable<Processo | null> {
    return this.firestoreService.getDocumentosAnalisados(processId);
  }

  getProcesses(): Observable<{ id: string }[]> {
    return this.firestoreService.getProcessos().pipe(
      map((procs) => procs.map((p) => ({ id: p.id })))
    );
  }

  deleteProcess(processId: string): Observable<void[]> {
    const deleteFirestore$ = this.firestoreService.deleteProcess(processId);
    const deleteStatus$ = this.firestoreService.deleteProcessStatus(processId);
    const storageRef = ref(this.storage, `processos/${processId}`);
    const deleteStorage$ = from(this.deleteFolder(storageRef));

    return forkJoin([deleteFirestore$, deleteStatus$, deleteStorage$]);
  }

  private async deleteFolder(folderRef: any) {
    const listResult = await listAll(folderRef);
    const deletePromises = listResult.items.map(item => deleteObject(item));
    await Promise.all(deletePromises);
  }
}
