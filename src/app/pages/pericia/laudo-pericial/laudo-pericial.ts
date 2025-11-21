import { ChangeDetectionStrategy, Component, computed, inject, signal, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { map, switchMap, tap, firstValueFrom, Subscription } from 'rxjs';
import { FirestoreService } from '../../../core/services/firestore.service';
import { CommonModule, Location } from '@angular/common';
import { Clipboard } from '@angular/cdk/clipboard';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';

// Serviços
import { DiretrizesService, Diretriz } from '../../../core/services/diretrizes.service';
import { PromptService } from '../../../core/services/prompt.service';
import { AnalysisService } from '../../../core/services/analysis.service';

// Material Imports
import { MarkdownModule } from 'ngx-markdown';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatListModule } from '@angular/material/list';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-laudo-pericial',
  templateUrl: './laudo-pericial.html',
  styleUrls: ['./laudo-pericial.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MarkdownModule,
    MatCardModule,
    MatButtonModule,
    MatProgressBarModule,
    MatExpansionModule,
    MatIconModule,
    MatInputModule,
    MatSnackBarModule,
    MatTabsModule,
    MatChipsModule,
    MatDividerModule,
    MatListModule,
    MatSelectModule,
    MatFormFieldModule,
    MatProgressSpinnerModule
  ],
})
export class LaudoPericialComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private firestoreService = inject(FirestoreService);
  private diretrizesService = inject(DiretrizesService);
  private promptService = inject(PromptService);
  private analysisService = inject(AnalysisService);
  private clipboard = inject(Clipboard);
  private snackBar = inject(MatSnackBar);
  private location = inject(Location);
  private cdr = inject(ChangeDetectorRef); // Injeção para atualização manual da tela

  laudoData: any = null;
  laudoBackup: any = null; // Para restaurar se cancelar
  processoId: string | null = null;

  // Variável para gerenciar a inscrição e evitar vazamento de memória
  private laudoSubscription: Subscription | null = null;

  // Controle do Modo de Edição
  isEditing = signal(false);

  // Ajuste no laudo$ para garantir que laudoData esteja sempre sincronizado e a tela atualize
  laudo$ = this.route.paramMap.pipe(
    map(params => params.get('id')),
    tap(id => this.processoId = id),
    switchMap(id => { 
      if (!id) return [];
      return this.firestoreService.getLaudoPericial(id);
    }),
    tap(laudo => {
      console.log('Laudo recebido no tap:', laudo); // Debug
      this.laudoData = laudo; 
      
      // Se o laudo já tiver uma análise salva, carrega no signal
      if (laudo && laudo.analiseIA) {
        this.resultadoAnaliseIA.set(laudo.analiseIA);
      }

      // FORÇA A ATUALIZAÇÃO DA TELA
      // Como estamos usando OnPush e a resposta vem de um evento assíncrono,
      // precisamos avisar o Angular explicitamente.
      this.cdr.markForCheck();
    })
  );

  // --- Lógica das Diretrizes e IA ---

  // 1. Carrega todas as diretrizes do banco
  todasDiretrizes = toSignal(this.diretrizesService.getDiretrizes(), { initialValue: [] });

  // 2. Sinal para o filtro de Justiça (Padrão: Justiça Federal)
  filtroJustica = signal<'Justiça Federal' | 'Justiça do Trabalho' | 'Justiça Comum'>('Justiça Federal');

  // 3. Diretrizes filtradas (Computed: atualiza automaticamente)
  diretrizesFiltradas = computed(() => {
    const lista = this.todasDiretrizes();
    const filtro = this.filtroJustica();
    return lista.filter(d => d.justica === filtro);
  });

  // 4. Armazena as diretrizes selecionadas pelo usuário
  diretrizesSelecionadas = signal<Diretriz[]>([]);

  // 5. Estado da Análise IA
  resultadoAnaliseIA = signal<string | null>(null);
  isAnalisando = signal(false);

  // --- CICLO DE VIDA (OnInit e OnDestroy) ---

  ngOnInit(): void {
    // Realiza a inscrição (subscribe) para disparar a busca dos dados
    this.laudoSubscription = this.laudo$.subscribe({
      error: (err) => {
        console.error('Erro ao carregar laudo:', err);
        this.showCopyMessage('Erro ao carregar dados do laudo.');
      }
    });
  }

  ngOnDestroy(): void {
    // Cancela a inscrição ao sair da tela para evitar vazamento de memória
    if (this.laudoSubscription) {
      this.laudoSubscription.unsubscribe();
    }
  }

  // --- MÉTODOS AUXILIARES ---

  objectKeys(obj: any): string[] {
    return Object.keys(obj || {});
  }

  goBack(): void {
    this.location.back();
  }

  private showCopyMessage(message: string) {
    this.snackBar.open(message, 'Fechar', {
      duration: 3000,
    });
  }

  toggleEdit() {
    if (this.isEditing()) {
      // Se estava editando e clicou de novo (sem salvar), cancela
      this.cancelarEdicao();
    } else {
      // Entrar no modo de edição: faz backup dos dados
      this.laudoBackup = JSON.parse(JSON.stringify(this.laudoData));
      this.isEditing.set(true);
    }
  }

  cancelarEdicao() {
    // Restaura os dados originais
    this.laudoData = JSON.parse(JSON.stringify(this.laudoBackup));
    this.isEditing.set(false);
    this.laudoBackup = null;
  }

  async salvarEdicao() {
    if (!this.processoId || !this.laudoData) return;

    try {
      
      if (this.resultadoAnaliseIA()) {
        this.laudoData.analiseIA = this.resultadoAnaliseIA();
      }
      // ---------------------

      // Chama o serviço do Firestore para atualizar
      await this.firestoreService.updateLaudoPericial(this.processoId, this.laudoData);
      
      this.showCopyMessage('Alterações salvas com sucesso!');
      this.isEditing.set(false);
      this.laudoBackup = null;
      this.cdr.markForCheck(); 
    } catch (error) {
      console.error('Erro ao salvar:', error);
      this.showCopyMessage('Erro ao salvar alterações.');
    }
  }

  // --- INTEGRAÇÃO COM IA (GEMINI) ---
  async analisarComIA() {
    // Validações Iniciais
    if (this.diretrizesSelecionadas().length === 0) {
      this.showCopyMessage('Selecione pelo menos uma diretriz para fundamentar a análise.');
      return;
    }

    if (!this.processoId) {
      this.showCopyMessage('Erro interno: ID do processo não identificado.');
      return;
    }

    this.isAnalisando.set(true);
    
    try {
      // 1. Busca o Prompt de Sistema (analise_federal)
      const promptConfig = await firstValueFrom(this.promptService.getPromptById('analise_federal'));

      if (!promptConfig || !promptConfig.prompt_text) {
        throw new Error('Configuração de prompt "analise_federal" não encontrada no sistema.');
      }

      // 2. Prepara o Conteúdo do Usuário (Dados do Laudo + Diretrizes Selecionadas)
      const jsonLaudo = this.getCleanLaudoJson(); // Pega apenas os dados relevantes
      
      const textoDiretrizes = this.diretrizesSelecionadas()
        .map(d => `--- DIRETRIZ SELECIONADA ---\nNome: ${d.nome}\nLink: ${d.link}\nResumo/Conteúdo: ${d.conteudo || 'Consultar link oficial'}`)
        .join('\n\n');

      const userContent = `
DADOS DO LAUDO PERICIAL (JSON ESTRUTURADO):
${JSON.stringify(jsonLaudo, null, 2)}

DIRETRIZES E NORMAS APLICÁVEIS SELECIONADAS PELO PERITO:
${textoDiretrizes}
      `;

      // 3. Chama o Serviço de IA (Cloud Function)
      const response = await firstValueFrom(this.analysisService.generateLaudoAnalysis({
        model: 'gemini-2.5-pro', 
        systemInstruction: promptConfig.prompt_text,
        userContent: userContent,
        temperature: 0.2 // Temperatura baixa para análise técnica/médica mais precisa
      }));

      const textoGerado = response.responseText;

      // 4. Salva o resultado no Firestore (campo 'analiseIA')
      await this.firestoreService.updateLaudoPericial(this.processoId, {
        analiseIA: textoGerado
      });

      // 5. Atualiza a tela
      this.resultadoAnaliseIA.set(textoGerado);
      this.showCopyMessage('Análise realizada e salva com sucesso!');
      this.cdr.markForCheck(); // Atualiza tela após retorno da IA

    } catch (error: any) {
      console.error('Erro durante a análise com IA:', error);
      this.showCopyMessage('Falha ao analisar: ' + (error.message || 'Erro desconhecido.'));
      
      // Se falhar e já existia algo salvo no banco, garante que a tela mostre o valor antigo
      if (this.laudoData?.analiseIA) {
        this.resultadoAnaliseIA.set(this.laudoData.analiseIA);
      }
      this.cdr.markForCheck();
    } finally {
      this.isAnalisando.set(false);
      this.cdr.markForCheck();
    }
  }

  // Função auxiliar para atualizar as diretrizes no signal
  atualizarDiretrizes(opcoes: any[]) {
    const valores = opcoes.map(opcao => opcao.value);
    this.diretrizesSelecionadas.set(valores);
  }

  // Helper para extrair apenas dados úteis do laudo (reduz tokens e ruído)
  private getCleanLaudoJson(): any {
    if (!this.laudoData) return {};
    return {
      identificacaoProcesso: this.laudoData.identificacaoProcesso,
      dadosPericiando: this.laudoData.dadosPericiando,
      historicoLaboral: this.laudoData.historicoLaboral,
      dadosMedicos: this.laudoData.dadosMedicos,
      OBSERVACOES: this.laudoData.OBSERVACOES,
      respostasQuesitos: this.laudoData.respostasQuesitos
      // Removemos metadados irrelevantes para a IA
    };
  }

  // Copiar JSON para Clipboard
  copyJsonToClipboard() {
    if (this.laudoData) {
      const filteredLaudo = this.getCleanLaudoJson();
      const jsonString = JSON.stringify(filteredLaudo, null, 2);
      this.clipboard.copy(jsonString);
      this.showCopyMessage('JSON copiado para a área de transferência!');
    }
  }

  // Copiar Prompt Completo (Manual) para Clipboard
  copyPromptToClipboard() {
    if (this.laudoData) {
      const promptHeader = `**Comando Principal:**

Você é "Perícias Médica Federal", um Médico do Trabalho e Perito Médico Federal. Atue conforme o Decreto Nº 3.048/1999 e normas selecionadas.

**Tarefa:**
Elabore um Laudo Médico Pericial fundamentado, utilizando exclusivamente os dados do JSON abaixo e seguindo a estrutura padrão (Identificação, Histórico, Exame Físico, Conclusão).

**Dados de Entrada (JSON):**

#JSON_de_Entrada#`;

      const filteredLaudo = this.getCleanLaudoJson();
      const jsonString = JSON.stringify(filteredLaudo, null, 2);
      const finalContentToCopy = promptHeader.replace('#JSON_de_Entrada#', jsonString);

      this.clipboard.copy(finalContentToCopy);
      this.showCopyMessage('Prompt manual copiado para a área de transferência!');
    }
  }
}