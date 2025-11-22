import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';

// --- Módulos do Angular Material ---
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';

// --- Serviços e Modelos ---
import { QuesitosService } from '../../../core/services/quesitos.service';
import { ModeloQuesito } from '../../../core/models/quesito.model';

@Component({
  selector: 'app-quesitos-manager',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    // Módulos Material
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatExpansionModule,
    MatSnackBarModule,
    MatChipsModule,
    MatTooltipModule
  ],
  // Ajustei os nomes dos arquivos para o padrão que você está usando (sem .component)
  templateUrl: './quesitos-manager.html',
  styleUrls: ['./quesitos-manager.css']
})
export class QuesitosManagerComponent {
  private quesitosService = inject(QuesitosService);
  private snackBar = inject(MatSnackBar); // Serviço para notificações elegantes

  // Dados do Firestore
  modelos$: Observable<ModeloQuesito[]> = this.quesitosService.getModelos();

  // Estado da Tela
  selectedModelo: ModeloQuesito | null = null;
  isCreating: boolean = false;
  
  // Editor JSON
  jsonInput: string = '';

  constructor() {
    // Template inicial para facilitar a criação
    this.jsonInput = `{
  "jurisdicao": "Salvador",
  "tipoAcao": "IL",
  "titulo": "Novo Modelo",
  "ativo": true,
  "quesitos": []
}`;
  }

  // Selecionar um modelo na barra lateral
  selectModelo(modelo: ModeloQuesito) {
    this.selectedModelo = modelo;
    this.isCreating = false;
  }

  // Botão "+ Novo"
  startCreation() {
    this.selectedModelo = null;
    this.isCreating = true;
  }

  // Ação "Salvar Modelo"
  saveFromJson() {
    try {
      const modeloObj: ModeloQuesito = JSON.parse(this.jsonInput);

      // Validação simples
      if (!modeloObj.titulo || !Array.isArray(modeloObj.quesitos)) {
        throw new Error('O JSON deve ter pelo menos um "titulo" e um array de "quesitos".');
      }

      this.quesitosService.addModelo(modeloObj).subscribe({
        next: () => {
          this.showNotification('Modelo criado com sucesso!', 'sucesso');
          this.isCreating = false;
          // Opcional: limpar o jsonInput aqui se desejar
        },
        error: (err) => {
          console.error(err);
          this.showNotification('Erro ao salvar no Firestore.', 'erro');
        }
      });

    } catch (e) {
      this.showNotification('Erro: JSON inválido. Verifique a sintaxe.', 'erro');
    }
  }

  // Ação "Copiar JSON"
  copyToClipboard() {
    if (!this.selectedModelo) return;

    // Removemos dados técnicos (ID, datas) para criar uma cópia limpa
    const { id, createdAt, updatedAt, ...modeloLimpo } = this.selectedModelo;
    const jsonStr = JSON.stringify(modeloLimpo, null, 2);

    navigator.clipboard.writeText(jsonStr).then(() => {
      this.showNotification('JSON copiado para a área de transferência!', 'info');
    }).catch(err => {
      console.error(err);
      this.showNotification('Não foi possível copiar.', 'erro');
    });
  }

  deleteCurrentModelo() {
    if (!this.selectedModelo || !this.selectedModelo.id) return;

    // Confirmação simples do navegador (rápido e eficaz)
    const confirmacao = confirm(`Tem certeza que deseja excluir o modelo "${this.selectedModelo.titulo}"? Esta ação não pode ser desfeita.`);

    if (confirmacao) {
      this.quesitosService.deleteModelo(this.selectedModelo.id).subscribe({
        next: () => {
          this.showNotification('Modelo excluído com sucesso.', 'sucesso');
          this.selectedModelo = null; // Limpa a seleção da tela
        },
        error: (err) => {
          console.error(err);
          this.showNotification('Erro ao excluir o modelo.', 'erro');
        }
      });
    }
  }
  
  formatDate(timestamp: any): string {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('pt-BR');
  }

  // Helper para padronizar as notificações (SnackBars)
  private showNotification(message: string, tipo: 'sucesso' | 'erro' | 'info') {
    this.snackBar.open(message, 'Fechar', {
      duration: 3000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
      panelClass: tipo === 'erro' ? ['mat-toolbar', 'mat-warn'] : undefined
    });
  }
}