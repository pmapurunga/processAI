import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

// Material
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTableModule } from '@angular/material/table';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner'; // <--- ADICIONADO AQUI

// Services & Models
import { PersonasService } from '../../../core/services/personas.service';
import { Persona, ConhecimentoItem } from '../../../core/models/persona.model';

@Component({
  selector: 'app-personas-manager',
  templateUrl: './personas-manager.html',
  styleUrls: ['./personas-manager.css'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatExpansionModule,
    MatTableModule,
    MatDialogModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatDividerModule,
    MatProgressSpinnerModule // <--- ADICIONADO AQUI TAMBÉM
  ]
})
export class PersonasManagerComponent implements OnInit {
  private personasService = inject(PersonasService);
  private snackBar = inject(MatSnackBar);

  // Lista principal
  listaPersonas = signal<Persona[]>([]);
  displayedColumns: string[] = ['status', 'nome', 'instrucoes', 'acoes'];

  // Estado de Edição
  isEditing = signal(false);
  isLoading = signal(false);

  // Objeto em edição (Formulário)
  currentPersona: Partial<Persona> = this.getEmptyPersona();
  
  // Controle dos itens de conhecimento
  conhecimentosTemp = signal<ConhecimentoItem[]>([]);

  ngOnInit() {
    this.carregarPersonas();
  }

  carregarPersonas() {
    this.isLoading.set(true);
    this.personasService.getPersonas().subscribe({
      next: (dados) => {
        this.listaPersonas.set(dados);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.mostrarMensagem('Erro ao carregar personas.');
        this.isLoading.set(false);
      }
    });
  }

  // --- MÉTODOS DE AÇÃO ---

  iniciarCriacao() {
    this.currentPersona = this.getEmptyPersona();
    this.conhecimentosTemp.set([]); // Limpa conhecimentos
    this.isEditing.set(true);
  }

  iniciarEdicao(persona: Persona) {
    // Clona o objeto para não editar a referência da tabela diretamente
    this.currentPersona = { ...persona };
    
    // Carrega os conhecimentos existentes ou inicia vazio
    this.conhecimentosTemp.set(persona.conhecimentos ? [...persona.conhecimentos] : []);
    
    this.isEditing.set(true);
  }

  cancelarEdicao() {
    this.isEditing.set(false);
    this.currentPersona = this.getEmptyPersona();
    this.conhecimentosTemp.set([]);
  }

  async salvarPersona() {
    if (!this.currentPersona.nome || !this.currentPersona.instrucoes) {
      this.mostrarMensagem('Preencha Nome e Instruções obrigatórias.');
      return;
    }

    this.isLoading.set(true);

    try {
      // Anexa os conhecimentos atuais ao objeto antes de salvar
      const dadosParaSalvar = {
        ...this.currentPersona,
        conhecimentos: this.conhecimentosTemp()
      };

      if (this.currentPersona.id) {
        // Atualização
        await this.personasService.updatePersona(this.currentPersona.id, dadosParaSalvar).toPromise();
        this.mostrarMensagem('Persona atualizada com sucesso!');
      } else {
        // Criação
        await this.personasService.createPersona(dadosParaSalvar).toPromise();
        this.mostrarMensagem('Nova Persona criada!');
      }

      this.cancelarEdicao();
      
    } catch (error) {
      console.error(error);
      this.mostrarMensagem('Erro ao salvar.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async deletarPersona(id: string) {
    if (confirm('Tem certeza que deseja excluir permanentemente esta Persona?')) {
      try {
        await this.personasService.deletePersona(id).toPromise();
        this.mostrarMensagem('Persona excluída.');
      } catch (e) {
        this.mostrarMensagem('Erro ao excluir.');
      }
    }
  }

  async toggleStatus(persona: Persona) {
    try {
      await this.personasService.toggleStatus(persona.id!, !!persona.ativo).toPromise();
      this.mostrarMensagem(`Status alterado para ${!persona.ativo ? 'Ativo' : 'Inativo'}`);
    } catch (e) {
      this.mostrarMensagem('Erro ao alterar status.');
    }
  }

  // --- GERENCIAMENTO DE CONHECIMENTO (SUBITENS) ---

  adicionarConhecimento() {
    this.conhecimentosTemp.update(lista => [...lista, { titulo: 'Novo Manual', conteudo: '' }]);
  }

  removerConhecimento(index: number) {
    this.conhecimentosTemp.update(lista => lista.filter((_, i) => i !== index));
  }

  atualizarConhecimento(index: number, campo: 'titulo' | 'conteudo', valor: string) {
    this.conhecimentosTemp.update(lista => {
      const novaLista = [...lista];
      novaLista[index] = { ...novaLista[index], [campo]: valor };
      return novaLista;
    });
  }

  // --- HELPERS ---

  private getEmptyPersona(): Partial<Persona> {
    return {
      nome: '',
      instrucoes: 'Você é um especialista em...',
      conhecimentos: [],
      ativo: true
    };
  }

  private mostrarMensagem(msg: string) {
    this.snackBar.open(msg, 'Fechar', { duration: 3000 });
  }
}