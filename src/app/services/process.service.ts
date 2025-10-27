
import { inject, Injectable } from '@angular/core';
import { forkJoin, map, Observable, from } from 'rxjs';
import { Processo } from '../models/process.model';
import { FirestoreService } from '../firestore.service';
import { Storage, ref, deleteObject, listAll, StorageError } from '@angular/fire/storage';

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
    // Garante que não há espaços em branco no ID
    const trimmedProcessId = processId.trim();

    const deleteFirestore$ = this.firestoreService.deleteProcess(trimmedProcessId);
    const deleteStatus$ = this.firestoreService.deleteProcessStatus(trimmedProcessId);
    const deleteStorage$ = from(this.deleteFolder(`processos/${trimmedProcessId}`));

    return forkJoin([deleteFirestore$, deleteStatus$, deleteStorage$]);
  }

  /**
   * Apaga recursivamente uma "pasta" e todo o seu conteúdo (arquivos e subpastas).
   * @param path O caminho completo da pasta a ser apagada.
   */
  private async deleteFolder(path: string): Promise<void> {
    const folderRef = ref(this.storage, path);
    
    try {
      const listResult = await listAll(folderRef);

      // Cria uma lista de promessas para apagar todos os arquivos
      const fileDeletePromises = listResult.items.map(itemRef => deleteObject(itemRef));
      
      // Cria uma lista de promessas para apagar todas as subpastas recursivamente
      const folderDeletePromises = listResult.prefixes.map(prefixRef => this.deleteFolder(prefixRef.fullPath));

      // Espera que todas as exclusões (arquivos e pastas) terminem
      await Promise.all([...fileDeletePromises, ...folderDeletePromises]);

    } catch (error) {
      const storageError = error as StorageError;
      // Se o erro for 'object-not-found', significa que a pasta não existe, o que não é um erro real.
      // A função pode terminar silenciosamente.
      if (storageError.code === 'storage/object-not-found') {
        console.log(`Pasta não encontrada (isso é normal se não havia arquivos): ${path}`);
        return;
      }
      
      // Para todos os outros erros, exibe no console e lança novamente.
      console.error(`Erro ao apagar a pasta "${path}":`, storageError);
      throw storageError;
    }
  }
}
