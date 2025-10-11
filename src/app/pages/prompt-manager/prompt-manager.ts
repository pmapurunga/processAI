import { ChangeDetectionStrategy, Component, computed, inject, signal, WritableSignal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PromptService, Prompt } from '../../services/prompt.service';

@Component({
  selector: 'app-prompt-manager',
  imports: [CommonModule, FormsModule],
  templateUrl: './prompt-manager.html',
  styleUrls: ['./prompt-manager.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PromptManagerComponent {
  private promptService = inject(PromptService);

  public prompts = toSignal(this.promptService.getPrompts(), { initialValue: [] });
  public isModalOpen = signal(false);
  public modalTitle = signal('Adicionar Novo Prompt');
  public currentPrompt: WritableSignal<Prompt | null> = signal(null);

  public isLoading = computed(() => this.prompts() === undefined);

  openModal(prompt?: Prompt): void {
    this.modalTitle.set(prompt ? 'Editar Prompt' : 'Adicionar Novo Prompt');
    this.currentPrompt.set(prompt ? { ...prompt } : { id: '', nome: '', prompt_text: '' });
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
    this.currentPrompt.set(null);
  }

  savePrompt(): void {
    const prompt = this.currentPrompt();
    if (!prompt || !prompt.id || !prompt.nome || !prompt.prompt_text) {
      alert('Por favor, preencha todos os campos.');
      return;
    }

    this.promptService.savePrompt(prompt).subscribe({
      next: () => this.closeModal(),
      error: (err) => alert(`Erro ao salvar: ${err.message}`),
    });
  }

  deletePrompt(id: string): void {
    const promptName = this.prompts().find(p => p.id === id)?.nome || id;
    if (confirm(`Tem certeza que deseja excluir o prompt "${promptName}"?`)) {
      this.promptService.deletePrompt(id).subscribe({
        error: (err) => alert(`Erro ao excluir: ${err.message}`),
      });
    }
  }
}
