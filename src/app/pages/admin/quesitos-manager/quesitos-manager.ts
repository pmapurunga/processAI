import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; // Necessário para o ngModel do textarea
import { QuesitosService } from '../../../core/services/quesitos.service';
import { ModeloQuesito } from '../../../core/models/quesito.model';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-quesitos-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './quesitos-manager.html',
  styleUrls: ['./quesitos-manager.css']
})
export class QuesitosManagerComponent {
  private quesitosService = inject(QuesitosService);

  // Lista de modelos do Firestore
  modelos$: Observable<ModeloQuesito[]> = this.quesitosService.getModelos();

  // Estado da tela
  selectedModelo: ModeloQuesito | null = null;
  isCreating: boolean = false;
  
  // Variável para armazenar o texto do JSON colado
  jsonInput: string = '';
  feedbackMessage: string = '';

  constructor() {
    // Inicia com um JSON de exemplo para facilitar
    this.jsonInput = `{
  "jurisdicao": "Salvador",
  "tipoAcao": "IL",
  "titulo": "Novo Modelo",
  "ativo": true,
  "quesitos": []
}`;
  }

  // Selecionar um modelo da lista lateral
  selectModelo(modelo: ModeloQuesito) {
    this.selectedModelo = modelo;
    this.isCreating = false;
    this.feedbackMessage = '';
  }

  // Ativar o modo de criação (tela do JSON)
  startCreation() {
    this.selectedModelo = null;
    this.isCreating = true;
    this.feedbackMessage = '';
  }

  // Ação do botão "Salvar JSON"
  saveFromJson() {
    try {
      // 1. Tenta converter o texto para Objeto Javascript
      const modeloObj: ModeloQuesito = JSON.parse(this.jsonInput);

      // 2. Validação básica (opcional, mas recomendada)
      if (!modeloObj.titulo || !Array.isArray(modeloObj.quesitos)) {
        throw new Error('O JSON deve ter pelo menos um "titulo" e um array de "quesitos".');
      }

      // 3. Envia para o Firestore
      this.quesitosService.addModelo(modeloObj).subscribe({
        next: () => {
          this.feedbackMessage = 'Sucesso! Modelo criado.';
          this.isCreating = false; 
          // Limpa a seleção ou volta para o modo visualização
          this.jsonInput = ''; // Limpa o input
        },
        error: (err) => {
          console.error(err);
          this.feedbackMessage = 'Erro ao salvar no Firestore.';
        }
      });

    } catch (e) {
      this.feedbackMessage = 'Erro: JSON inválido. Verifique a sintaxe (aspas, vírgulas).';
    }
  }
  
  // Função auxiliar para formatar a visualização da data
  formatDate(timestamp: any): string {
    if (!timestamp) return '';
    // Se for Timestamp do Firestore, converte para Date
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('pt-BR');
  }
}