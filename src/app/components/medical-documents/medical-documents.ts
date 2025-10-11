import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MedicalDocument } from './medical-document.model';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-medical-documents',
  templateUrl: './medical-documents.html',
  styleUrls: ['./medical-documents.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule]
})
export class MedicalDocumentsComponent {
  medicalDocuments = input.required<MedicalDocument[]>();
}
