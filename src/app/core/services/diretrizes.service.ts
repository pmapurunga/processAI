import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, addDoc, deleteDoc, doc } from '@angular/fire/firestore';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { GoogleDocsUtils } from '../utils/google-docs-utils';
import { environment } from '../../../environments/environment'; // Importa as configurações

export interface Diretriz {
  id?: string;
  nome: string;
  justica: 'Justiça Comum' | 'Justiça do Trabalho' | 'Justiça Federal';
  link: string;
  conteudo?: string;
}

@Injectable({
  providedIn: 'root'
})
export class DiretrizesService {
  // Injeções
  private firestore: Firestore = inject(Firestore);
  private http: HttpClient = inject(HttpClient);

  private collectionPath = 'diretrizes';
  private diretrizesCollection = collection(this.firestore, this.collectionPath);

  constructor() { }

  // --- Métodos CRUD do Firestore (Mantidos) ---

  getDiretrizes(): Observable<Diretriz[]> {
    return collectionData(this.diretrizesCollection, { idField: 'id' }) as Observable<Diretriz[]>;
  }

  addDiretriz(diretriz: Diretriz): Promise<any> {
    const { id, ...data } = diretriz;
    return addDoc(this.diretrizesCollection, data);
  }

  deleteDiretriz(id: string): Promise<void> {
    const docRef = doc(this.firestore, `${this.collectionPath}/${id}`);
    return deleteDoc(docRef);
  }

  // --- Novo Método: Extração de Conteúdo ---

  /**
   * Recebe o link do documento, usa a chave do FirebaseConfig para chamar a API
   * e retorna o Markdown formatado.
   */
  // ... dentro de src/app/core/services/diretrizes.service.ts

  async getDocContent(url: string): Promise<string> {
    console.log('--- [DEBUG] Iniciando getDocContent ---');
    console.log('1. URL recebida:', url);

    // 1. Extrair o ID do link
    const fileId = GoogleDocsUtils.extractFileId(url);
    console.log('2. ID extraído:', fileId);

    if (!fileId) {
      console.error('ERRO: ID do arquivo não encontrado na URL.');
      throw new Error('O link fornecido não é um link válido do Google Docs.');
    }

    // 2. Verificar a chave
    const apiKey = environment.googleApiKey;
    // Vamos mostrar apenas os primeiros caracteres da chave por segurança no log
    console.log('3. API Key encontrada:', apiKey ? 'Sim (' + apiKey.substring(0, 5) + '...)' : 'NÃO');

    if (!apiKey) {
      throw new Error('Erro de Configuração: API Key não encontrada.');
    }

    // 3. Montar a URL da API
    const apiUrl = `https://docs.googleapis.com/v1/documents/${fileId}?key=${apiKey}`;
    console.log('4. Chamando API Google Docs...');

    try {
      // 4. Fazer o pedido GET à Google
      const docData = await firstValueFrom(this.http.get<any>(apiUrl));
      console.log('5. Resposta da API Google recebida (Raw Data):', docData ? 'Objeto recebido' : 'Vazio');

      // 5. Converter
      const markdown = GoogleDocsUtils.convertToMarkdown(docData);
      console.log('6. Markdown gerado (primeiros 100 chars):', markdown.substring(0, 100));

      return markdown;

    } catch (error: any) {
      console.error('--- [ERRO CRÍTICO NA API] ---', error);

      if (error.status === 403) {
        console.error('Dica: Verifique se a Google Docs API está ATIVADA no Google Cloud Console.');
        throw new Error('Acesso negado (403). API não ativada ou documento privado.');
      } else if (error.status === 404) {
        throw new Error('Documento não encontrado (404).');
      }

      throw error;
    }
  }
}