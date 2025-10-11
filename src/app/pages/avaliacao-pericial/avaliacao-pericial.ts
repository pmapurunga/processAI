import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';

@Component({
  selector: 'app-avaliacao-pericial',
  imports: [CommonModule],
  template: `
    <div class="page-container">
      <div class="page-header">
        <button (click)="goBack()" class="back-button">← Voltar</button>
        <h1>Avaliação Pericial</h1>
      </div>
      <div class="container">
        <p>Avaliação Pericial works!</p>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvaliacaoPericialComponent {
  private location = inject(Location);

  goBack(): void {
    this.location.back();
  }
}
