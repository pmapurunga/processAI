import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';

@Component({
  selector: 'app-confirm-dialog',
  template: `
    <h1 mat-dialog-title>Confirmar Exclusão</h1>
    <div mat-dialog-content>
      <p>Tem certeza que deseja apagar este processo?</p>
    </div>
    <div mat-dialog-actions>
      <button mat-button [mat-dialog-close]="false">Cancelar</button>
      <button mat-button [mat-dialog-close]="true" cdkFocusInitial>Apagar</button>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatButtonModule],
})
export class ConfirmDialogComponent {}
