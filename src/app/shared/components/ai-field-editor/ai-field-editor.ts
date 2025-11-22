// src/app/shared/components/ai-field-editor/ai-field-editor.ts
import { Component, Inject, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AnalysisService } from '../../../core/services/analysis.service'; // Verifique o caminho
import { firstValueFrom } from 'rxjs';

export interface AiEditorData {
  fieldName: string;
  currentValue: string;
  fullContext: any; // O JSON do laudo para contexto
}

@Component({
  selector: 'app-ai-field-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './ai-field-editor.html',
  styleUrls: ['./ai-field-editor.css']
})
export class AiFieldEditorComponent {
  private analysisService = inject(AnalysisService);
  
  userInstruction = signal('');
  aiResult = signal<string | null>(null);
  isLoading = signal(false);

  constructor(
    public dialogRef: MatDialogRef<AiFieldEditorComponent>,
    @Inject(MAT_DIALOG_DATA) public data: AiEditorData
  ) {}

  async performAnalysis() {
    if (!this.userInstruction()) return;
    
    this.isLoading.set(true);
    
    try {
      // Engenharia do Prompt
      const prompt = `
      CONTEXTO GERAL (JSON DO LAUDO):
      ${JSON.stringify(this.data.fullContext)}

      ---
      TAREFA DE EDIÇÃO ESPECÍFICA:
      CAMPO ALVO: "${this.data.fieldName}"
      CONTEÚDO ATUAL:
      "${this.data.currentValue}"

      INSTRUÇÃO DO USUÁRIO (O QUE FAZER): 
      "${this.userInstruction()}"

      AÇÃO:
      Reescreva o "CONTEÚDO ATUAL" seguindo rigorosamente a instrução do usuário.
      Use o "CONTEXTO GERAL" apenas para garantir coerência (ex: nomes, datas, diagnósticos corretos).
      
      SAÍDA:
      Retorne APENAS o novo texto reescrito. Não inclua aspas, explicações ou markdown extra.
      `;

      const response = await firstValueFrom(this.analysisService.generateLaudoAnalysis({
        model: 'gemini-2.5-pro', // Usando o modelo mais inteligente
        systemInstruction: 'Você é um assistente de redação pericial experiente e preciso.',
        userContent: prompt,
        temperature: 0.5 
      }));

      this.aiResult.set(response.responseText.trim());
    } catch (error) {
      console.error(error);
      this.aiResult.set('Erro ao processar solicitação. Verifique sua conexão e tente novamente.');
    } finally {
      this.isLoading.set(false);
    }
  }

  apply() {
    // Devolve o texto modificado para quem abriu o dialog
    this.dialogRef.close(this.aiResult());
  }

  cancel() {
    this.dialogRef.close();
  }
}