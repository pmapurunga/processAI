import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

// Interfaces existentes para análise de documentos
export interface AnalysisRequest {
  driveUrl: string;
  processId: string;
  promptId: string;
}

export interface AnalysisResponse {
  message: string;
  processId: string;
  filesFound: number;
}

// NOVA INTERFACE: Payload para a geração de texto com IA
export interface GenAIPayload {
  model: string;            // Ex: 'gemini-1.5-pro'
  systemInstruction: string; // O prompt do sistema (configuração)
  userContent: string;       // O conteúdo dinâmico (JSON do laudo + Diretrizes)
  temperature?: number;      // Opcional: Criatividade da IA (0.0 a 1.0)
}

@Injectable({
  providedIn: 'root',
})
export class AnalysisService {
  private http = inject(HttpClient);

  // URL existente para processamento de arquivos
  private analysisFunctionUrl = 'https://iniciar-analise-http-dh5jkkqpaa-uc.a.run.app';

  // NOVA URL: Endpoint para geração de texto/chat (IA)
  // IMPORTANTE: Substitua pela URL real da sua Cloud Function quando a criar.
  // Exemplo: 'https://us-central1-seu-projeto.cloudfunctions.net/gerarAnaliseLaudo'
  private genAiFunctionUrl = 'https://us-central1-processai-468612.cloudfunctions.net/gerarAnaliseLaudo';

  // Método existente: Inicia a análise de documentos do Drive
  startAnalysis(request: AnalysisRequest): Observable<AnalysisResponse> {
    return this.http.post<AnalysisResponse>(this.analysisFunctionUrl, request).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('Ocorreu um erro ao chamar a Cloud Function (Start Analysis):', error.message);
        return throwError(() => new Error(error.error?.message || 'Erro desconhecido do servidor.'));
      })
    );
  }

  // NOVO MÉTODO: Gera a análise textual do Laudo usando IA
  generateLaudoAnalysis(payload: GenAIPayload): Observable<{ responseText: string }> {
    return this.http.post<{ responseText: string }>(this.genAiFunctionUrl, payload).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('Erro na chamada da IA (Generate Laudo):', error);
        return throwError(() => new Error(error.error?.message || 'Falha ao gerar análise com IA.'));
      })
    );
  }
}