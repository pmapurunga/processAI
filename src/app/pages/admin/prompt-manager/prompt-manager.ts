import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PromptService, Prompt } from '../../../core/services/prompt.service';

// Material Imports
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip'; // Adicionado para suportar o matTooltip

@Component({
  selector: 'app-prompt-manager',
  templateUrl: './prompt-manager.html',
  styleUrls: ['./prompt-manager.css'],
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    MatIconModule,
    MatListModule,
    MatDividerModule,
    MatTooltipModule // Certifica-te de incluir este se usares tooltips
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PromptManagerComponent {
  private promptService: PromptService = inject(PromptService);

  prompts = toSignal(this.promptService.getPrompts(), { initialValue: [] });
  selectedPrompt = signal<Prompt | null>(null);
  
  // Novo sinal para controlar se é modo de edição
  isEditMode = signal(false);

  editPrompt(prompt: Prompt | null) {
    // Define se estamos em modo de edição (se prompt existe) ou criação (se null)
    this.isEditMode.set(!!prompt);

    if (prompt) {
      // Clona o objeto para edição
      this.selectedPrompt.set({ ...prompt });
    } else {
      // Inicia um novo com campos vazios
      this.selectedPrompt.set({ id: '', nome: '', prompt_text: '' });
    }
  }

  savePrompt(prompt: Prompt) {
    // Validação simples agora inclui verificar se há um ID (caso o utilizador queira definir manualmente)
    if (!prompt.nome || !prompt.prompt_text) {
      alert('O nome e o texto do prompt são obrigatórios.');
      return;
    }
    
    // Se for um novo prompt e o utilizador não inseriu ID, o serviço gera um.
    // Mas se quiseres obrigar o utilizador a inserir o ID, podes adicionar:
    // if (!prompt.id) { alert('O ID é obrigatório'); return; }

    this.promptService.savePrompt(prompt).subscribe({
      next: () => {
        this.selectedPrompt.set(null); // Fecha o formulário
      },
      error: (err) => {
        console.error('Erro ao salvar o prompt:', err);
        alert('Não foi possível salvar o prompt.');
      },
    });
  }

  deletePrompt(id: string, event: Event) {
    event.stopPropagation();
    const promptName = this.prompts().find(p => p.id === id)?.nome || 'o prompt';
    
    if (confirm(`Tem certeza que deseja excluir "${promptName}"?`)) {
      this.promptService.deletePrompt(id).subscribe({
        error: (err) => {
          console.error('Erro ao excluir o prompt:', err);
          alert('Não foi possível excluir o prompt.');
        },
      });
    }
  }
}