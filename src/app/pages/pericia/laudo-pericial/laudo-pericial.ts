import { ChangeDetectionStrategy, Component, computed, inject, signal, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { map, switchMap, tap, firstValueFrom, Subscription } from 'rxjs';
import { FirestoreService } from '../../../core/services/firestore.service';
import { CommonModule, Location } from '@angular/common';
import { Clipboard } from '@angular/cdk/clipboard';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { LaudoFormatter } from '../../../core/utils/laudo-formatter.utils';

// Serviços
import { DiretrizesService, Diretriz } from '../../../core/services/diretrizes.service';
import { PromptService } from '../../../core/services/prompt.service';
import { AnalysisService } from '../../../core/services/analysis.service';
import { QuesitosService } from '../../../core/services/quesitos.service';
import { PersonasService } from '../../../core/services/personas.service'; 

// Models
import { ModeloQuesito } from '../../../core/models/quesito.model';
import { Persona } from '../../../core/models/persona.model'; 

// Components
import { AiFieldEditorComponent } from '../../../shared/components/ai-field-editor/ai-field-editor';

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
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatListOption, MatSelectionListChange } from '@angular/material/list';

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
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
})
export class LaudoPericialComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private firestoreService = inject(FirestoreService);
  private diretrizesService = inject(DiretrizesService);
  private promptService = inject(PromptService);
  private analysisService = inject(AnalysisService);
  private quesitosService = inject(QuesitosService);
  private personasService = inject(PersonasService);
  private clipboard = inject(Clipboard);
  private snackBar = inject(MatSnackBar);
  private location = inject(Location);
  private cdr = inject(ChangeDetectorRef);
  private dialog = inject(MatDialog);

  laudoData: any = null;
  laudoBackup: any = null;
  processoId: string | null = null;

  private laudoSubscription: Subscription | null = null;

  // Controle do Modo de Edição
  isEditing = signal(false);

  // Carregamento do Laudo
  laudo$ = this.route.paramMap.pipe(
    map(params => params.get('id')),
    tap(id => this.processoId = id),
    switchMap(id => {
      if (!id) return [];
      return this.firestoreService.getLaudoPericial(id);
    }),
    tap(laudo => {
      this.laudoData = laudo;

      if (laudo && laudo.analiseIA) {
        this.resultadoAnaliseIA.set(laudo.analiseIA);
      }

      this.cdr.markForCheck();
    })
  );

  // --- PERSONAS ---
  listaPersonas = toSignal(this.personasService.getPersonas(true), { initialValue: [] });
  personaSelecionada = signal<Persona | null>(null);

  // --- Diretrizes (Analise Geral) ---
  todasDiretrizes = toSignal(this.diretrizesService.getDiretrizes(), { initialValue: [] });
  filtroJustica = signal<'Justiça Federal' | 'Justiça do Trabalho' | 'Justiça Comum'>('Justiça Federal');
  
  // [NOVO] Signal para armazenar o termo digitado na busca
  termoBuscaDiretrizes = signal('');

  // [ALTERADO] Computed que filtra por Justiça E pelo texto da busca
  diretrizesFiltradas = computed(() => {
    const lista = this.todasDiretrizes();
    const filtro = this.filtroJustica();
    // Pega o termo digitado, coloca em minúsculas e remove espaços extras
    const busca = this.termoBuscaDiretrizes().toLowerCase().trim();

    return lista.filter(d => {
      // 1. Verifica se pertence à Esfera Judicial selecionada (Federal, Trabalho, etc)
      const matchJustica = d.justica === filtro;
      
      // 2. Verifica a busca textual
      // Se não tiver nada digitado, considera que deu "match" no texto (retorna true)
      // Se tiver, procura no Nome OU no Conteúdo da diretriz
      const matchTexto = !busca || 
                         d.nome.toLowerCase().includes(busca) || 
                         (d.conteudo && d.conteudo.toLowerCase().includes(busca));

      // Retorna apenas se passar nos DOIS filtros
      return matchJustica && matchTexto;
    });
  });

  diretrizesSelecionadas = signal<Diretriz[]>([]);
  resultadoAnaliseIA = signal<string | null>(null);
  isAnalisando = signal(false);

  // --- Automação de Quesitos ---
  listaModelosQuesitos = toSignal(this.quesitosService.getModelos(), { initialValue: [] });
  modeloSelecionado = signal<ModeloQuesito | null>(null);
  isRespondendoQuesitos = signal(false);

  // --- CICLO DE VIDA ---

  ngOnInit(): void {
    this.laudoSubscription = this.laudo$.subscribe({
      error: (err) => {
        console.error('Erro ao carregar laudo:', err);
        this.showCopyMessage('Erro ao carregar dados do laudo.');
      }
    });
  }

  ngOnDestroy(): void {
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
      this.cancelarEdicao();
    } else {
      this.laudoBackup = JSON.parse(JSON.stringify(this.laudoData));
      this.isEditing.set(true);
    }
  }

  cancelarEdicao() {
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

  // --- HELPER: CONTEXTO DE CONHECIMENTO ---
  private montarContextoConhecimento(persona: Persona): string {
    if (!persona.conhecimentos || persona.conhecimentos.length === 0) return '';
    
    const conhecimentosTexto = persona.conhecimentos
      .map((c, i) => `--- FONTE ${i + 1}: ${c.titulo} ---\n${c.conteudo}`)
      .join('\n\n');

    return `
=================================================================
BASE DE CONHECIMENTO DA PERSONA (Use isso como verdade absoluta):
${conhecimentosTexto}
=================================================================
    `;
  }

  // --- INTEGRAÇÃO IA 1: ANÁLISE GERAL COM DIRETRIZES ---
  async analisarComIA() {
    if (this.diretrizesSelecionadas().length === 0) {
      this.showCopyMessage('Selecione pelo menos uma diretriz.');
      return;
    }
    if (!this.processoId) return;

    this.isAnalisando.set(true);

    try {
      // 1. Recupera o Prompt Base (A "Tarefa")
      const promptConfig = await firstValueFrom(this.promptService.getPromptById('analise_federal'));

      if (!promptConfig || !promptConfig.prompt_text) {
        throw new Error('Prompt "analise_federal" não encontrado.');
      }

      const jsonLaudo = this.getCleanLaudoJson();

      const textoDiretrizes = this.diretrizesSelecionadas()
        .map(d => `--- DIRETRIZ (${d.nome}) ---\n${d.conteudo || 'SEM CONTEÚDO'}`)
        .join('\n\n');

      // 2. Configura Persona (System Instruction + Knowledge)
      const persona = this.personaSelecionada();
      let systemInstruction = promptConfig.prompt_text; // Fallback se não tiver persona
      let knowledgeContext = '';
      let taskInstruction = '';

      if (persona) {
        // Se tem persona, a System Instruction é a identidade da persona
        systemInstruction = persona.instrucoes;
        // O conhecimento da persona entra no User Content
        knowledgeContext = this.montarContextoConhecimento(persona);
        // O prompt original vira a instrução da tarefa
        taskInstruction = `
        INSTRUÇÃO DA TAREFA:
        ${promptConfig.prompt_text}
        `;
      }

      const userContent = `
${knowledgeContext}

DADOS DO LAUDO:
${JSON.stringify(jsonLaudo, null, 2)}

DIRETRIZES SELECIONADAS:
${textoDiretrizes}

${taskInstruction}
INSTRUÇÃO FINAL:
Use as diretrizes acima e a base de conhecimento para fundamentar a análise.
      `;

      const response = await firstValueFrom(this.analysisService.generateLaudoAnalysis({
        model: 'gemini-2.5-pro',
        systemInstruction: systemInstruction,
        userContent: userContent,
        temperature: 0.3,
        processId: this.processoId!, 
        actionContext: 'analise_geral_diretrizes'
      }));

      const textoGerado = response.responseText;

      await this.firestoreService.updateLaudoPericial(this.processoId, {
        analiseIA: textoGerado
      });

      this.resultadoAnaliseIA.set(textoGerado);
      this.showCopyMessage('Análise realizada com sucesso!');

    } catch (error: any) {
      console.error('Erro IA:', error);
      this.showCopyMessage('Falha ao analisar.');
    } finally {
      this.isAnalisando.set(false);
      this.cdr.markForCheck();
    }
  }

  // --- NOVOS MÉTODOS PARA CORRIGIR A SELEÇÃO ---

  // Verifica se a diretriz está na lista de selecionados (baseado no ID)
  // Isso garante que o item apareça marcado mesmo depois de filtrar e limpar a busca
  isDiretrizSelected(diretriz: Diretriz): boolean {
    return this.diretrizesSelecionadas().some(d => d.id === diretriz.id);
  }

  // Gerencia a seleção: Adiciona se não tiver, Remove se já tiver
  toggleDiretrizSelection(event: MatSelectionListChange) {
    const changedOption = event.options[0]; // Pega o item que foi clicado
    const diretriz = changedOption.value;
    const isSelected = changedOption.selected;

    // Cria uma cópia da lista atual para não mutar o signal diretamente
    const listaAtual = [...this.diretrizesSelecionadas()];

    if (isSelected) {
      // Se o usuário marcou e o item NÃO está na lista, adiciona
      if (!listaAtual.some(d => d.id === diretriz.id)) {
        listaAtual.push(diretriz);
      }
    } else {
      // Se o usuário desmarcou, procura e remove da lista
      const index = listaAtual.findIndex(d => d.id === diretriz.id);
      if (index !== -1) {
        listaAtual.splice(index, 1);
      }
    }

    // Atualiza o signal com a nova lista consolidada
    this.diretrizesSelecionadas.set(listaAtual);
  }

  copiarJsonFinal() {
    if (!this.laudoData) {
      this.showCopyMessage('Ainda não há dados carregados para gerar o JSON.');
      return;
    }
  
    try {
      const jsonFinal = LaudoFormatter.gerarJsonFinal(this.laudoData);
      const jsonString = JSON.stringify(jsonFinal, null, 2);
      const sucesso = this.clipboard.copy(jsonString);
  
      if (sucesso) {
        this.showCopyMessage('JSON Final copiado com sucesso!');
        console.log('JSON Final Gerado:', jsonFinal);
      } else {
        this.showCopyMessage('Erro ao copiar para a área de transferência.');
      }
  
    } catch (error) {
      console.error('Erro ao formatar JSON:', error);
      this.showCopyMessage('Erro interno ao gerar a formatação final.');
    }
  }

  // --- INTEGRAÇÃO IA 2: AUTOMAÇÃO DE QUESITOS ---

  aplicarModeloQuesitos(modelo: ModeloQuesito) {
    this.modeloSelecionado.set(modelo);
    this.laudoData.modeloQuesitoId = modelo.id;

    if (!this.laudoData.respostasQuesitos) {
      this.laudoData.respostasQuesitos = {};
    }

    const quesitosOrdenados = [...modelo.quesitos].sort((a, b) => a.ordem - b.ordem);

    quesitosOrdenados.forEach(q => {
      const numero = q.id.replace(/\D/g, '');
      const chaveTecnica = `RESPOSTA_QUESITO_${numero}`;

      if (!this.laudoData.respostasQuesitos[chaveTecnica]) {
        this.laudoData.respostasQuesitos[chaveTecnica] = q.respostaPadrao || '';
      }
    });

    this.showCopyMessage(`Modelo "${modelo.titulo}" aplicado!`);
  }

  getTextoPergunta(chave: string): string {
    let modeloParaConsultar = this.modeloSelecionado();

    if (!modeloParaConsultar && this.laudoData?.modeloQuesitoId) {
      const lista = this.listaModelosQuesitos();
      modeloParaConsultar = lista.find(m => m.id === this.laudoData.modeloQuesitoId) || null;
    }

    if (!modeloParaConsultar) return '';

    const numero = chave.replace(/\D/g, '');
    const idBusca = 'q' + numero;
    const quesitoEncontrado = modeloParaConsultar.quesitos.find(q => q.id === idBusca);

    return quesitoEncontrado ? quesitoEncontrado.texto : '';
  }

  async responderQuesitosComIA() {
    const modelo = this.modeloSelecionado();

    if (!modelo) {
      this.showCopyMessage('Selecione um modelo primeiro.');
      return;
    }

    if (!modelo.promptIA) {
      this.showCopyMessage('ERRO: Este modelo não possui Prompt de IA cadastrado.');
      return;
    }

    if (!this.processoId) return;

    this.isRespondendoQuesitos.set(true);

    try {
      const jsonLaudo = this.getCleanLaudoJson();
      const persona = this.personaSelecionada();

      let systemInstruction = "Você é um assistente pericial. Responda estritamente em JSON.";
      let knowledgeContext = '';

      if (persona) {
        systemInstruction = persona.instrucoes + " IMPORTANTE: A saída DEVE ser estritamente um JSON válido.";
        knowledgeContext = this.montarContextoConhecimento(persona);
      }

      const userContent = `
      ${knowledgeContext}

      DADOS DO LAUDO PERICIAL:
      ${JSON.stringify(jsonLaudo, null, 2)}

      ---
      TAREFA E REGRAS ESPECÍFICAS (PROMPT DO MODELO):
      ${modelo.promptIA}

      ---
      FORMATO DE SAÍDA OBRIGATÓRIO (JSON):
      Retorne APENAS um objeto JSON onde as chaves são os IDs dos quesitos (ex: "q1", "q4") e os valores as respostas.
      `;

      const response = await firstValueFrom(this.analysisService.generateLaudoAnalysis({
        model: 'gemini-2.5-pro', 
        systemInstruction: systemInstruction,
        userContent: userContent,
        temperature: 0.2, 
        responseMimeType: 'application/json',
        processId: this.processoId!,
        actionContext: `resposta_quesitos_modelo_${modelo.id}`
      }));

      let respostasIA: any = {};
      try {
        respostasIA = JSON.parse(response.responseText);
      } catch (e) {
        console.error('Falha no JSON Parse:', response.responseText);
        throw new Error('A IA não retornou um JSON válido, mesmo com JSON Mode.');
      }

      let atualizados = 0;
      
      modelo.quesitos.forEach(q => {
        const respostaGerada = respostasIA[q.id]; 
        
        if (respostaGerada) {
          const numero = q.id.replace(/\D/g, ''); 
          const chaveTecnica = `RESPOSTA_QUESITO_${numero}`;
          this.laudoData.respostasQuesitos[chaveTecnica] = respostaGerada;
          atualizados++;
        }
      });

      await this.firestoreService.updateLaudoPericial(this.processoId, {
        respostasQuesitos: this.laudoData.respostasQuesitos,
        modeloQuesitoId: this.laudoData.modeloQuesitoId
      });

      this.showCopyMessage(`${atualizados} quesitos respondidos e salvos!`);
      this.cdr.markForCheck();

    } catch (error: any) {
      console.error('Erro Quesitos IA:', error);
      this.showCopyMessage('Erro ao gerar respostas: ' + error.message);
    } finally {
      this.isRespondendoQuesitos.set(false);
    }
  }

  // --- HELPERS ---
  private getCleanLaudoJson(): any {
    if (!this.laudoData) return {};
    const { respostasQuesitos, ...rest } = this.laudoData;
    return {
      identificacaoProcesso: rest.identificacaoProcesso,
      dadosPericiando: rest.dadosPericiando,
      historicoLaboral: rest.historicoLaboral,
      dadosMedicos: rest.dadosMedicos,
      OBSERVACOES: rest.OBSERVACOES,
      respostasQuesitos: rest.respostasQuesitos,
    };
  }

  copyJsonToClipboard() {
    if (this.laudoData) {
      this.clipboard.copy(JSON.stringify(this.laudoData, null, 2));
      this.showCopyMessage('JSON completo copiado!');
    }
  }

  abrirMelhoriaIA(tituloCampo: string, objetoAlvo: any, nomePropriedade: string) {
    if (!objetoAlvo) return;

    const valorAtual = objetoAlvo[nomePropriedade] || '';

    const dialogRef = this.dialog.open(AiFieldEditorComponent, {
      width: '900px',
      disableClose: true,
      data: {
        fieldName: tituloCampo,
        currentValue: valorAtual,
        fullContext: this.getCleanLaudoJson()
      }
    });

    dialogRef.afterClosed().subscribe(novoTexto => {
      if (novoTexto !== undefined) {
        objetoAlvo[nomePropriedade] = novoTexto;
        this.cdr.markForCheck();
        this.showCopyMessage('Campo atualizado com IA!');
      }
    });
  }

  copyPromptToClipboard() {
    const jsonString = JSON.stringify(this.getCleanLaudoJson(), null, 2);
    this.clipboard.copy("Use este JSON: " + jsonString);
    this.showCopyMessage('Dados copiados!');
  }
}