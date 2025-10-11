import { ChangeDetectionStrategy, Component, inject, signal, effect } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';

import { AnalysisService, AnalysisRequest } from '../../services/analysis.service';
import { PromptService } from '../../services/prompt.service';

type Status = 'idle' | 'loading' | 'success' | 'error';

@Component({
  selector: 'app-new-analysis',
  imports: [CommonModule, FormsModule],
  templateUrl: './new-analysis.html',
  styleUrls: ['./new-analysis.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class NewAnalysisComponent {
  private analysisService = inject(AnalysisService);
  private promptService = inject(PromptService);

  // Form State
  driveUrl = signal('');
  processId = signal('');
  promptId = signal('');

  // UI State
  status = signal<Status>('idle');
  feedbackMessage = signal('');

  // Data from Services
  prompts = toSignal(this.promptService.getPrompts(), { initialValue: [] });

  constructor() {
    // Effect to set the default prompt ID once prompts are loaded
    effect(() => {
      const loadedPrompts = this.prompts();
      if (loadedPrompts.length > 0 && !this.promptId()) {
        this.promptId.set(loadedPrompts[0].id);
      }
    });
  }

  startAnalysis() {
    if (!this.driveUrl() || !this.processId() || !this.promptId()) {
      this.status.set('error');
      this.feedbackMessage.set('Por favor, preencha todos os campos.');
      return;
    }

    this.status.set('loading');

    const request: AnalysisRequest = {
      driveUrl: this.driveUrl(),
      processId: this.processId(),
      promptId: this.promptId(),
    };

    this.analysisService.startAnalysis(request).pipe(
      finalize(() => {
        // This will run on completion or error, ensuring the loading state is always removed.
        if (this.status() === 'loading') {
          this.status.set('idle'); // Or handle specific cases if needed
        }
      })
    ).subscribe({
      next: (response) => {
        this.status.set('success');
        this.feedbackMessage.set(`${response.message}. Foram encontrados ${response.filesFound} arquivo(s) na pasta.`);
        this.resetForm();
      },
      error: (error) => {
        this.status.set('error');
        this.feedbackMessage.set(`Falha ao iniciar análise: ${error.message}`);
      }
    });
  }

  reset() {
    this.status.set('idle');
    this.resetForm();
  }

  private resetForm() {
    this.driveUrl.set('');
    this.processId.set('');
    if (this.prompts().length > 0) {
      this.promptId.set(this.prompts()[0].id);
    }
  }
}
