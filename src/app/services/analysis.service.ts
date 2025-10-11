import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

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

@Injectable({
  providedIn: 'root',
})
export class AnalysisService {
  private http = inject(HttpClient);

  private analysisFunctionUrl = 'https://iniciar-analise-http-dh5jkkqpaa-uc.a.run.app';

  startAnalysis(request: AnalysisRequest): Observable<AnalysisResponse> {
    return this.http.post<AnalysisResponse>(this.analysisFunctionUrl, request).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('Ocorreu um erro ao chamar a Cloud Function:', error.message);
        return throwError(() => new Error(error.error?.message || 'Erro desconhecido do servidor.'));
      })
    );
  }
}
