import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';

// Material
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';

// Core
import { QuesitosService } from '../../../core/services/quesitos.service';
import { ModeloQuesito, QuesitoItem } from '../../../core/models/quesito.model';

@Component({
  selector: 'app-quesitos-manager',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatDividerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatSnackBarModule,
    MatTabsModule,
    MatTooltipModule
  ],
  templateUrl: './quesitos-manager.html',
  styleUrls: ['./quesitos-manager.css']
})
export class QuesitosManagerComponent {
  private quesitosService = inject(QuesitosService);
  private snackBar = inject(MatSnackBar);

  // Lista de modelos carregada do banco
  listaModelos = toSignal(this.quesitosService.getModelos(), { initialValue: [] });

  // Estado do formulário
  modeloEmEdicao = signal<ModeloQuesito | null>(null);
  
  // String do JSON para edição no textarea
  jsonQuesitosString = signal('');

  // -------------------------------------------------------
  // AÇÕES DE SELEÇÃO E CRIAÇÃO
  // -------------------------------------------------------

  iniciarNovo() {
    this.modeloEmEdicao.set({
      titulo: 'Novo Modelo de Quesitos',
      jurisdicao: 'Feira de Santana', // Valor padrão
      tipoAcao: 'IL',                 // Valor padrão
      ativo: true,
      quesitos: [],
      promptIA: ''                    // Novo campo vazio
    });

    // JSON inicial vazio
    this.jsonQuesitosString.set('{\n  "quesitos": []\n}');
  }

  selecionarModelo(modelo: ModeloQuesito) {
    // Cria uma cópia para não alterar a lista diretamente enquanto edita
    const copiaModelo = JSON.parse(JSON.stringify(modelo));
    this.modeloEmEdicao.set(copiaModelo);

    // Prepara o JSON para exibição no textarea
    // Envolvemos num objeto { quesitos: [...] } para facilitar a leitura/colagem
    const wrapper = { quesitos: copiaModelo.quesitos };
    this.jsonQuesitosString.set(JSON.stringify(wrapper, null, 2));
  }

  cancelar() {
    this.modeloEmEdicao.set(null);
    this.jsonQuesitosString.set('');
  }

  // -------------------------------------------------------
  // LÓGICA DE EDIAÇÃO DO JSON
  // -------------------------------------------------------

  atualizarJsonQuesitos(texto: string) {
    this.jsonQuesitosString.set(texto);
  }

  // -------------------------------------------------------
  // SALVAMENTO
  // -------------------------------------------------------

  async salvar() {
    const modelo = this.modeloEmEdicao();
    const jsonTexto = this.jsonQuesitosString();

    if (!modelo) return;

    // 1. Tenta fazer o parse do JSON dos Quesitos
    try {
      const parsed = JSON.parse(jsonTexto);
      
      if (Array.isArray(parsed.quesitos)) {
        modelo.quesitos = parsed.quesitos;
      } else if (Array.isArray(parsed)) {
        // Caso o usuário cole direto o array [...]
        modelo.quesitos = parsed;
      } else {
        throw new Error('O JSON deve conter uma propriedade "quesitos": [] ou ser um array.');
      }
    } catch (e) {
      this.showSnack('Erro no JSON de Quesitos: Verifique a sintaxe.');
      return;
    }

    // 2. Validação do Prompt
    if (!modelo.promptIA || modelo.promptIA.trim().length < 10) {
      const confirmar = confirm('O campo "Prompt IA" está vazio ou muito curto. Deseja salvar mesmo assim? (A automação não funcionará sem ele).');
      if (!confirmar) return;
    }

    // 3. Envia para o Firestore
    try {
      if (modelo.id) {
        // Atualização
        await firstValueFrom(this.quesitosService.updateModelo(modelo.id, modelo));
        this.showSnack('Modelo atualizado com sucesso!');
      } else {
        // Criação
        await firstValueFrom(this.quesitosService.addModelo(modelo));
        this.showSnack('Novo modelo criado com sucesso!');
      }
      
      // Reseta o form
      this.cancelar();

    } catch (error) {
      console.error(error);
      this.showSnack('Erro ao salvar modelo.');
    }
  }

  // -------------------------------------------------------
  // UTILITÁRIOS
  // -------------------------------------------------------

  colarExemploPrompt() {
    const exemplo = `Você é um Médico do Trabalho e um Perito Médico Federal.
Atue conforme o Decreto 3.048/99.
Responda aos quesitos abaixo com base no JSON fornecido.

REGRA DE FORMATAÇÃO:
Para quesitos de ( ) Sim / ( ) Não, marque com (X) a opção correta.

LISTA DE QUESTÕES PARA RESPONDER:
...`;
    
    if (this.modeloEmEdicao()) {
      const modelo = this.modeloEmEdicao()!;
      modelo.promptIA = exemplo;
      this.modeloEmEdicao.set({ ...modelo }); // Trigger update
    }
  }

  private showSnack(msg: string) {
    this.snackBar.open(msg, 'Fechar', { duration: 3000 });
  }
}