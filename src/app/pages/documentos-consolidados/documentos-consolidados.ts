import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';

@Component({
  selector: 'app-documentos-consolidados',
  imports: [CommonModule],
  template: `
    <div class="page-container">
      <div class="page-header">
        <button (click)="goBack()" class="back-button">← Voltar</button>
        <h1>Documentos Consolidados</h1>
      </div>
      <div class="container">
        <p>Documentos Consolidados works!</p>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentosConsolidadosComponent {
  private location = inject(Location);

  goBack(): void {
    this.location.back();
  }
}
