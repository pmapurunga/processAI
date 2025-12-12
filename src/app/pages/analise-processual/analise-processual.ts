import { Component, ChangeDetectionStrategy, signal, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatListModule } from '@angular/material/list';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { NgxFileDropModule, NgxFileDropEntry, FileSystemFileEntry } from 'ngx-file-drop';
import { HttpClient } from '@angular/common/http';
import { ProcessAnalysisService, AnalysedDocument } from '../../core/services/process-analysis.service';
import { GooglePickerService } from '../../core/services/google-picker.service';
import { Subscription, interval, switchMap, takeWhile } from 'rxjs';

@Component({
    selector: 'app-analise-processual',
    templateUrl: './analise-processual.html',
    styleUrls: ['./analise-processual.css'],
    standalone: true,
    imports: [
        CommonModule,
        MatButtonModule,
        MatIconModule,
        MatCardModule,
        MatProgressBarModule,
        MatListModule,
        MatListModule,
        NgxFileDropModule,
        MatSnackBarModule
    ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AnaliseProcessualComponent {
    private analysisService = inject(ProcessAnalysisService);
    private httpClient = inject(HttpClient);
    private cdr = inject(ChangeDetectorRef);
    private snackBar = inject(MatSnackBar);

    public files: NgxFileDropEntry[] = [];
    public isHovering = false;

    // State Signals (ou propriedades simples com CDR por ser complexo async)
    public isProcessing = false;
    public uploadProgress = 0;
    public analysisProgress = 0;
    public currentJobId: string | null = null;

    public analyzedDocs: AnalysedDocument[] = [];

    private statusSub?: Subscription;

    constructor() { }

    public dropped(files: NgxFileDropEntry[]) {
        this.files = files;
        for (const droppedFile of files) {
            if (droppedFile.fileEntry.isFile) {
                const fileEntry = droppedFile.fileEntry as FileSystemFileEntry;
                fileEntry.file((file: File) => {
                    // Validar tipo (PDF/Imagem)
                    if (file.type !== 'application/pdf') {
                        alert('Apenas arquivos PDF são permitidos inicialmente.');
                        return;
                    }
                    this.uploadFile(file);
                });
            }
        }
    }

    public fileOver(event: any) {
        this.isHovering = true;
    }

    public fileLeave(event: any) {
        this.isHovering = false;
    }

    private uploadFile(file: File) {
        // Limpar estado anterior se começar novo
        this.resetStateForNewAnalysis();

        this.isProcessing = true;
        this.uploadProgress = 1;
        this.cdr.markForCheck();

        // 1. Obter Signed URL
        const metadata = { name: file.name, size: file.size, type: file.type };

        this.analysisService.getUploadUrl(metadata).subscribe({
            next: (response) => {
                this.currentJobId = response.jobId;

                // 2. Upload para GCS via PUT
                // NOTA: HttpClient do Angular não suporta progresso de upload PUT facilmente sem config específica de reportProgress
                // Faremos uma requisição manual com reportProgress: true

                this.httpClient.put(response.uploadUrl, file, {
                    reportProgress: true,
                    observe: 'events',
                    headers: { 'Content-Type': file.type }
                }).subscribe({
                    next: (event: any) => {
                        if (event.type === 1) { // HttpEventType.UploadProgress
                            const percentDone = Math.round(100 * event.loaded / (event.total || 1));
                            this.uploadProgress = percentDone;
                            this.cdr.markForCheck();
                        } else if (event.type === 4) { // HttpEventType.Response
                            // Upload completo
                            this.startAnalysis(response.jobId, `gs://bucket-placeholder/uploads/${file.name}`);
                        }
                    },
                    error: (err) => {
                        console.error('Upload Error', err);
                        this.isProcessing = false;
                        alert('Erro no upload.');
                        this.cdr.markForCheck();
                    }
                });
            },
            error: (err) => {
                console.error('Erro ao obter URL de upload', err);
                alert('Falha ao iniciar upload.');
                this.isProcessing = false;
                this.cdr.markForCheck();
            }
        });
    }

    private startAnalysis(jobId: string, filePath: string) {
        this.uploadProgress = 100;

        // Iniciar Backend Trigger
        this.analysisService.startProcessing(jobId, filePath).subscribe({
            next: () => {
                // Notificar usuário e liberar UI
                this.snackBar.open('Análise iniciada! O processo está em andamento.', 'OK', {
                    duration: 5000,
                    horizontalPosition: 'center',
                    verticalPosition: 'bottom'
                });

                this.isProcessing = false; // Libera a UI de upload
                this.monitorStatus(jobId);
                this.cdr.markForCheck();
            },
            error: (err) => {
                console.error('Trigger Error', err);
                // Mesmo com erro no trigger (timeout), o backend pode ter startado. 
                // Vamos tentar monitorar mesmo assim, mas mantemos isProcessing false para não travar
                this.snackBar.open('Solicitação enviada. Verificando status...', 'OK', { duration: 3000 });
                this.isProcessing = false;
                this.monitorStatus(jobId);
                this.cdr.markForCheck();
            }
        });
    }

    private monitorStatus(jobId: string) {
        // Polling do status geral da Análise
        // Numa app real com AngularFire, usariamos docData() stream.
        // O service ja retorna observable do docData.

        this.statusSub = this.analysisService.getAnalysisStatus(jobId).subscribe(status => {
            console.log('Status update received:', status);
            if (!status) return;

            this.analysisProgress = status.progresso || 0;

            if (status.status === 'CONCLUIDO') {
                console.log('Analysis concluded successfully.');
                this.isProcessing = false;
            } else if (status.status === 'ERRO') {
                console.error('Analysis failed:', status);
                this.isProcessing = false;
                alert('Ocorreu um erro durante a análise: ' + (status as any).erro || 'Erro desconhecido');
            }
            this.cdr.markForCheck();
        });

        // Monitorar documentos individuais "pipocando"
        this.analysisService.getAnalyzedDocuments(jobId).subscribe(docs => {
            // Ordenar por ordem de pagina
            this.analyzedDocs = docs.sort((a, b) => a.ordem - b.ordem);
            this.cdr.markForCheck();
        });
    }

    private googlePickerService = inject(GooglePickerService);

    public importFromDrive() {
        this.googlePickerService.openPicker().subscribe({
            next: (file) => {
                // Iniciar processamento
                this.resetStateForNewAnalysis();

                this.isProcessing = true;
                this.uploadProgress = 100; // Drive é instantâneo na nossa API
                this.cdr.markForCheck();

                this.analysisService.importFromDrive(file.id, file.oauthToken).subscribe({
                    next: (res) => {
                        this.currentJobId = res.jobId;

                        // Notificar usuário e liberar UI (Igual ao startAnalysis)
                        this.snackBar.open('Importação iniciada! A análise está em andamento.', 'OK', {
                            duration: 5000,
                            horizontalPosition: 'center',
                            verticalPosition: 'bottom'
                        });

                        this.isProcessing = false;
                        this.monitorStatus(res.jobId);
                        this.cdr.markForCheck();
                    },
                    error: (err) => {
                        console.error('Erro ao importar do Drive', err);
                        this.isProcessing = false;
                        alert('Falha na importação do Google Drive.');
                        this.cdr.markForCheck();
                    }
                });
            }
        });
    }

    // Helpers para template
    public hasData(obj: any): boolean {
        return obj && Object.keys(obj).length > 0;
    }

    public getKeys(obj: any): string[] {
        return obj ? Object.keys(obj) : [];
    }

    private resetStateForNewAnalysis() {
        this.analyzedDocs = [];
        this.currentJobId = null;
        if (this.statusSub) {
            this.statusSub.unsubscribe();
            this.statusSub = undefined;
        }
    }
}
