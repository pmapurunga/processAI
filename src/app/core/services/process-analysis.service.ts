import { Injectable, inject, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Firestore, docData, collectionData } from '@angular/fire/firestore';
import { collection, doc } from 'firebase/firestore';
import { Observable } from 'rxjs';

export interface UploadUrlResponse {
    uploadUrl: string;
    jobId: string;
}

export interface DriveImportResponse {
    jobId: string;
}

export interface ProcessAnalysisStatus {
    jobId: string;
    status: 'PROCESSANDO' | 'CONCLUIDO' | 'ERRO';
    progresso: number;
    data_criacao: any;
    usuario_uid: string;
    nome_arquivo: string;
    url_arquivo_original: string;
}

export interface AnalysedDocument {
    id_documento_pje: string;
    titulo_original: string;
    categoria_ia: string;
    paginas_pdf: number[];
    resumo: string;
    dados_extraidos: any;
    ordem: number;
}

@Injectable({
    providedIn: 'root'
})
export class ProcessAnalysisService {
    private http = inject(HttpClient);
    private firestore = inject(Firestore);
    private injector = inject(EnvironmentInjector);

    // API Cloud Run (Real)
    private readonly apiUrl = 'https://us-central1-processai-468612.cloudfunctions.net/process_analysis_api/api';

    constructor() { }

    // 1. Solicitar URL de Upload (Upload Local)
    getUploadUrl(metadata: { name: string; size: number; type: string }): Observable<UploadUrlResponse> {
        return this.http.post<UploadUrlResponse>(`${this.apiUrl}/upload-url`, metadata);
    }

    // 2. Notificar início de processamento após upload direto
    startProcessing(jobId: string, filePath: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/processar`, { jobId, filePath });
    }

    // 3. Importar do Google Drive
    importFromDrive(fileId: string, oAuthToken: string): Observable<DriveImportResponse> {
        console.log('Sending import request to backend for', fileId);
        return this.http.post<DriveImportResponse>(`${this.apiUrl}/importar-drive`, { fileId, oAuthToken });
    }

    // 4. Monitorar Status da Análise (Firestore)
    getAnalysisStatus(jobId: string): Observable<ProcessAnalysisStatus | undefined> {
        const docRef = doc(this.firestore, `analises_processos/${jobId}`);
        return runInInjectionContext(this.injector, () => docData(docRef) as Observable<ProcessAnalysisStatus | undefined>);
    }

    // 5. Monitorar Documentos Analisados (Sub-coleção Firestore)
    getAnalyzedDocuments(jobId: string): Observable<AnalysedDocument[]> {
        const colRef = collection(this.firestore, `analises_processos/${jobId}/documentos_analisados`);
        return runInInjectionContext(this.injector, () => collectionData(colRef, { idField: 'id_documento_pje' }) as Observable<AnalysedDocument[]>);
    }
}
