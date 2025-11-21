import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { Diretriz, DiretrizesService } from '../../services/diretrizes.service';

// Material Imports
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

@Component({
  selector: 'app-diretrizes',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatIconModule,
    MatChipsModule,
    MatDividerModule,
    MatSnackBarModule
  ],
  templateUrl: './diretrizes.html',
  styleUrls: ['./diretrizes.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiretrizesComponent {
  private diretrizesService = inject(DiretrizesService);
  private fb = inject(FormBuilder);
  private snackBar = inject(MatSnackBar);

  // Sinais
  diretrizes = toSignal(this.diretrizesService.getDiretrizes(), { initialValue: [] });
  isFormVisible = signal(false); // Controla se o formulário aparece ou não

  // Formulário
  form = this.fb.group({
    nome: ['', Validators.required],
    justica: ['Justiça Federal', Validators.required], // Valor padrão
    link: ['', [Validators.required]] // Poderíamos adicionar validação de URL aqui se necessário
  });

  toggleForm() {
    this.isFormVisible.update(v => !v);
  }

  onSubmit() {
    if (this.form.valid) {
      const novaDiretriz = this.form.value as Diretriz;
      
      this.diretrizesService.addDiretriz(novaDiretriz)
        .then(() => {
          this.snackBar.open('Diretriz adicionada com sucesso!', 'Fechar', { duration: 3000 });
          this.form.reset({ justica: 'Justiça Federal' }); // Reseta mantendo o padrão
          this.isFormVisible.set(false);
        })
        .catch(err => {
          console.error(err);
          this.snackBar.open('Erro ao salvar.', 'Fechar', { duration: 3000 });
        });
    }
  }

  deleteItem(id: string) {
    if(confirm('Tem a certeza que deseja apagar esta diretriz?')) {
      this.diretrizesService.deleteDiretriz(id)
        .then(() => this.snackBar.open('Diretriz removida.', 'OK', { duration: 2000 }))
        .catch(() => this.snackBar.open('Erro ao remover.', 'OK', { duration: 2000 }));
    }
  }

  openLink(url: string) {
    window.open(url, '_blank');
  }

  // Auxiliar para cor do chip
  getJusticaColor(tipo: string): string {
    switch(tipo) {
      case 'Justiça Federal': return 'primary';
      case 'Justiça do Trabalho': return 'warn';
      default: return 'accent'; // Justiça Comum
    }
  }
}