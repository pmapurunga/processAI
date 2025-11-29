import { inject, Injectable } from '@angular/core';
import { forkJoin, map, Observable, from, of, switchMap, take, catchError } from 'rxjs';
import { Processo } from '../models/process.model';
import { FirestoreService } from './firestore.service';
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

  deleteProcess(processId: string): Observable<any[]> {
      const trimmedProcessId = processId.trim();
      const folderPath = `${trimmedProcessId}/`;

      // 1. Recupera os documentos para extrair os caminhos dos arquivos antes de apagar do Firestore
      return this.firestoreService.getDocumentosAnalisados(trimmedProcessId).pipe(
        take(1),
        catchError(err => {
            console.warn('Erro ao buscar documentos para exclusão de arquivos:', err);
            return of([]); // Se falhar ao buscar docs, prossegue para tentar apagar a pasta padrão
        }),
        switchMap((docs: any[]) => {
            const filesToDelete = new Set<string>();

            // Extrai caminhos dos documentos
            if (docs && Array.isArray(docs)) {
                docs.forEach(doc => {
                    if (doc.linkArquivoPDF) {
                        const path = this.extractPathFromUrl(doc.linkArquivoPDF);
                        if (path) filesToDelete.add(path);
                    }
                });
            }

            console.log(`Arquivos identificados para exclusão:`, Array.from(filesToDelete));
            console.log(`Tentando apagar também a pasta: "${folderPath}"`);

            // 2. Executa exclusão do Storage (Arquivos específicos + Pasta do Processo)
            const storageCleanup$ = from(this.performStorageCleanup(Array.from(filesToDelete), folderPath));

            // 3. Operações do Firestore
            const deleteFirestore$ = this.firestoreService.deleteProcess(trimmedProcessId);
            const deleteStatus$ = this.firestoreService.deleteProcessStatus(trimmedProcessId);

            return forkJoin([storageCleanup$, deleteFirestore$, deleteStatus$]);
        })
      );
    }

  private extractPathFromUrl(url: string): string | null {
      try {
          if (!url || !url.includes('firebasestorage.googleapis.com')) return null;
          const urlObj = new URL(url);
          // Firebase Storage URLs format: .../b/bucket/o/path%2Fto%2Ffile?alt=...
          const pathStart = urlObj.pathname.indexOf('/o/');
          if (pathStart > -1) {
              const encodedPath = urlObj.pathname.substring(pathStart + 3);
              return decodeURIComponent(encodedPath);
          }
          return null;
      } catch (e) {
          console.error('Erro ao extrair path da URL:', url, e);
          return null;
      }
  }

  private async performStorageCleanup(specificFilePaths: string[], folderPath: string): Promise<void> {
      const promises: Promise<any>[] = [];

      // 1. Apaga arquivos específicos encontrados nos documentos
      specificFilePaths.forEach(path => {
          const fileRef = ref(this.storage, path);
          promises.push(
              deleteObject(fileRef)
                  .then(() => console.log(`Arquivo apagado: ${path}`))
                  .catch(err => {
                      if (err.code !== 'storage/object-not-found') {
                          console.warn(`Falha ao apagar arquivo ${path}:`, err);
                      }
                  })
          );
      });

      // 2. Apaga a pasta padrão (recursivamente)
      promises.push(this.deleteFolder(folderPath));

      await Promise.all(promises);
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
        return;
      }

      // Para todos os outros erros, exibe no console (exceto se for permissão/outros irrelevantes para cleanup)
      console.warn(`Erro ao apagar a pasta "${path}":`, storageError);
    }
  }
}
