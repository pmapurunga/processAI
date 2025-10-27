
import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PromptService, Prompt } from '../../services/prompt.service';

@Component({
  selector: 'app-prompt-manager',
  templateUrl: './prompt-manager.html',
  // O CSS não foi modificado, então não preciso reverter.
  styleUrls: ['./prompt-manager.css'], 
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PromptManagerComponent {
  private promptService: PromptService = inject(PromptService);

  prompts = toSignal(this.promptService.getPrompts(), { initialValue: [] });
  selectedPrompt = signal<Prompt | null>(null);

  editPrompt(prompt: Prompt | null) {
    // Se o prompt for nulo, cria um novo objeto para um novo prompt.
    if (prompt) {
      this.selectedPrompt.set({ ...prompt });
    } else {
      this.selectedPrompt.set({ id: '', nome: '', descricao: '', texto: '' });
    }
  }

  savePrompt(prompt: Prompt) {
    if (!prompt.nome || !prompt.texto) {
      alert('O nome e o texto do prompt são obrigatórios.');
      return;
    }
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

  deletePrompt(id: string) {
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
