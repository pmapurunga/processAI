import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ProcessService } from '../services/process.service';
import { Processo } from '../models/process.model';
import { switchMap } from 'rxjs/operators';
import { CommonModule, Location } from '@angular/common';
import { DocumentCardComponent } from '../document-card/document-card';
import { Clipboard } from '@angular/cdk/clipboard';
import { MedicalDocumentsComponent } from '../components/medical-documents/medical-documents';
import { MedicalDocument } from '../components/medical-documents/medical-document.model';

@Component({
  selector: 'app-process-detail',
  templateUrl: './process-detail.html',
  styleUrls: ['./process-detail.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, DocumentCardComponent, MedicalDocumentsComponent],
})
export class ProcessDetailComponent {
  private route = inject(ActivatedRoute);
  private processService = inject(ProcessService);
  private clipboard = inject(Clipboard);
  private location = inject(Location);

  processId = signal<string | null>(null);
  process = signal<Processo | null>(null);
  copyButtonText = signal('Copiar JSONs');
  showMedicalDocs = signal(false);

  medicalDocuments = computed(() => {
    const proc = this.process();
    if (!proc) return [];

    return proc.flatMap(doc =>
      (doc.documentosMedicosAnexados || []).map(medDoc => ({
        ...medDoc,
        idDocumento: doc.idDocumento,
      }))
    ) as MedicalDocument[];
  });

  constructor() {
    this.route.paramMap.pipe(
      switchMap(params => {
        const id = params.get('id');
        this.processId.set(id);
        if (id) {
          return this.processService.getProcess(id);
        }
        return [];
      })
    ).subscribe(process => {
      this.process.set(process);
    });
  }

  goBack(): void {
    this.location.back();
  }

  copyJsonsToClipboard() {
    const processData = this.process();
    if (processData) {
      const jsonString = JSON.stringify(processData, null, 2);
      this.clipboard.copy(jsonString);
      this.copyButtonText.set('Copiado!');
      setTimeout(() => this.copyButtonText.set('Copiar JSONs'), 2000);
    }
  }

  toggleMedicalDocs() {
    this.showMedicalDocs.set(!this.showMedicalDocs());
  }
}
