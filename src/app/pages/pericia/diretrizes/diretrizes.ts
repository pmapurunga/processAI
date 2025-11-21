import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { Diretriz, DiretrizesService } from '../../../core/services/diretrizes.service';

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
// Novos imports para o botão de download
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

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
    MatSnackBarModule,
    MatTooltipModule,        // <-- Novo
    MatProgressSpinnerModule // <-- Novo
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
  isFormVisible = signal(false); 
  isLoadingContent = signal(false); // <-- Novo: Controla o spinner de carregamento

  // Formulário
  form = this.fb.group({
    nome: ['', Validators.required],
    justica: ['Justiça Federal', Validators.required], 
    link: ['', [Validators.required]], 
    conteudo: [''] // <-- Novo: Campo para guardar o Markdown (pode ser hidden ou visível)
  });

  toggleForm() {
    this.isFormVisible.update(v => !v);
  }

  // --- Nova Função: Importar Conteúdo ---
  // ... dentro de src/app/pages/pericia/diretrizes/diretrizes.ts

  async importContent() {
    const url = this.form.get('link')?.value;
    console.log('--- [DEBUG UI] Botão Importar Clicado ---');
    console.log('Link no formulário:', url);
    
    if (!url) return;

    this.isLoadingContent.set(true);

    try {
      // Chama o serviço
      const markdown = await this.diretrizesService.getDocContent(url);
      console.log('--- [DEBUG UI] Markdown recebido no componente ---');
      console.log('Tamanho do texto:', markdown.length);
      
      // Preenche o formulário
      this.form.patchValue({ conteudo: markdown });
      
      // Verifica se o formulário atualizou mesmo
      const valorNoForm = this.form.get('conteudo')?.value;
      console.log('Valor atualizado no Input do Form:', valorNoForm ? 'OK (Preenchido)' : 'ERRO (Vazio)');

      this.snackBar.open('Conteúdo importado com sucesso!', 'OK', { duration: 3000 });
    } catch (err: any) {
      console.error('Erro no importContent:', err);
      this.snackBar.open(err.message || 'Erro ao importar conteúdo.', 'Fechar', { duration: 5000 });
    } finally {
      this.isLoadingContent.set(false);
    }
  }

  onSubmit() {
    console.log('--- [DEBUG UI] Tentando Salvar ---');
    
    if (this.form.valid) {
      const formValue = this.form.value;
      console.log('Dados do formulário a enviar:', formValue); // <--- AQUI VAMOS VER SE O 'conteudo' ESTÁ LÁ

      const novaDiretriz = formValue as Diretriz;
      
      this.diretrizesService.addDiretriz(novaDiretriz)
        .then(() => {
          console.log('Sucesso ao salvar no Firestore');
          this.snackBar.open('Diretriz adicionada com sucesso!', 'Fechar', { duration: 3000 });
          this.form.reset({ justica: 'Justiça Federal' }); 
          this.isFormVisible.set(false);
          this.isLoadingContent.set(false);
        })
        .catch(err => {
          console.error('Erro ao salvar no Firestore:', err);
          this.snackBar.open('Erro ao salvar.', 'Fechar', { duration: 3000 });
        });
    } else {
      console.warn('Formulário inválido:', this.form.errors);
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

  getJusticaColor(tipo: string): string {
    switch(tipo) {
      case 'Justiça Federal': return 'primary';
      case 'Justiça do Trabalho': return 'warn';
      default: return 'accent'; 
    }
  }
}