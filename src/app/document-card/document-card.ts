import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Documento } from '../models/process.model';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-document-card',
  templateUrl: './document-card.html',
  styleUrls: ['./document-card.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule],
})
export class DocumentCardComponent {
  document = input.required<Documento>();
}
