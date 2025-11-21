import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PromptService, Prompt } from '../../services/prompt.service';

// Material Imports
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';

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
    MatDividerModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PromptManagerComponent {
  private promptService: PromptService = inject(PromptService);

  prompts = toSignal(this.promptService.getPrompts(), { initialValue: [] });
  selectedPrompt = signal<Prompt | null>(null);

  editPrompt(prompt: Prompt | null) {
    if (prompt) {
      // Clona o objeto para edição
      this.selectedPrompt.set({ ...prompt });
    } else {
      // Inicia um novo com campos vazios
      this.selectedPrompt.set({ id: '', nome: '', prompt_text: '' });
    }
  }

  savePrompt(prompt: Prompt) {
    if (!prompt.nome || !prompt.prompt_text) {
      // Em Material Design, idealmente usaríamos MatSnackBar, mas alert serve por enquanto
      alert('O nome e o texto do prompt são obrigatórios.');
      return;
    }
    this.promptService.savePrompt(prompt).subscribe({
      next: () => {
        this.selectedPrompt.set(null); // Fecha o formulário/card de edição
      },
      error: (err) => {
        console.error('Erro ao salvar o prompt:', err);
        alert('Não foi possível salvar o prompt.');
      },
    });
  }

  deletePrompt(id: string, event: Event) {
    event.stopPropagation(); // Evita abrir a edição ao clicar no excluir
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