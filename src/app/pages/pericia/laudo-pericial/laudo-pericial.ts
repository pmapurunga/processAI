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
import { QuesitosService } from '../../../core/services/quesitos.service';
import { PersonasService } from '../../../core/services/personas.service'; // <--- NOVO SERVIÇO

// Models
import { ModeloQuesito } from '../../../core/models/quesito.model';
import { Persona } from '../../../core/models/persona.model'; // <--- NOVO MODEL

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
import { MatTooltipModule } from '@angular/material/tooltip'; // Opcional, mas bom para UX

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
  private personasService = inject(PersonasService); // <--- Injeção
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

  // --- PERSONAS (NOVA LÓGICA) ---
  // Carrega apenas personas ativas
  listaPersonas = toSignal(this.personasService.getPersonas(true), { initialValue: [] });
  personaSelecionada = signal<Persona | null>(null);

  // --- Diretrizes (Legado/Analise Geral) ---
  todasDiretrizes = toSignal(this.diretrizesService.getDiretrizes(), { initialValue: [] });
  filtroJustica = signal<'Justiça Federal' | 'Justiça do Trabalho' | 'Justiça Comum'>('Justiça Federal');

  diretrizesFiltradas = computed(() => {
    const lista = this.todasDiretrizes();
    const filtro = this.filtroJustica();
    return lista.filter(d => d.justica === filtro);
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
  // Monta a string com os conhecimentos da persona para injetar no userContent
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
        // --- NOVOS CAMPOS ADICIONADOS ---
        processId: this.processoId!, // Garante que sabemos de qual processo é o gasto
        actionContext: 'analise_geral_diretrizes' // Nome para identificar nos gráficos depois
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

  atualizarDiretrizes(opcoes: any[]) {
    const valores = opcoes.map(opcao => opcao.value);
    this.diretrizesSelecionadas.set(valores);
  }

  // --- INTEGRAÇÃO IA 2: AUTOMAÇÃO DE QUESITOS ---

  aplicarModeloQuesitos(modelo: ModeloQuesito) {
    this.modeloSelecionado.set(modelo);
    this.laudoData.modeloQuesitoId = modelo.id;

    if (!this.laudoData.respostasQuesitos) {
      this.laudoData.respostasQuesitos = {};
    }

    // Ordena e cria campos vazios se não existirem
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

  // Respondendo Quesitos (AGORA COM JSON MODE + PERSONA)
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

      // Configuração da Persona e Conhecimento
      let systemInstruction = "Você é um assistente pericial. Responda estritamente em JSON.";
      let knowledgeContext = '';

      if (persona) {
        systemInstruction = persona.instrucoes + " IMPORTANTE: A saída DEVE ser estritamente um JSON válido.";
        knowledgeContext = this.montarContextoConhecimento(persona);
      }

      // Monta o payload para o Gemini
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

      // Chama a IA com JSON MODE ATIVADO
      const response = await firstValueFrom(this.analysisService.generateLaudoAnalysis({
        model: 'gemini-2.5-pro', 
        systemInstruction: systemInstruction,
        userContent: userContent,
        temperature: 0.2, 
        responseMimeType: 'application/json',
        // --- NOVOS CAMPOS ADICIONADOS ---
        processId: this.processoId!,
        actionContext: `resposta_quesitos_modelo_${modelo.id}` // Ex: resposta_quesitos_modelo_m1
      }));

      // Parsing direto (sem regex gambiarra)
      let respostasIA: any = {};
      try {
        respostasIA = JSON.parse(response.responseText);
      } catch (e) {
        console.error('Falha no JSON Parse:', response.responseText);
        throw new Error('A IA não retornou um JSON válido, mesmo com JSON Mode.');
      }

      // Atualiza a tela
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

      // Salva no Firestore
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
      // Cópia completa conforme solicitado
      this.clipboard.copy(JSON.stringify(this.laudoData, null, 2));
      this.showCopyMessage('JSON completo copiado!');
    }
  }

  // Método genérico para abrir a IA para qualquer campo
abrirMelhoriaIA(tituloCampo: string, objetoAlvo: any, nomePropriedade: string) {
  // Verifica se o objeto existe para evitar erros
  if (!objetoAlvo) return;

  const valorAtual = objetoAlvo[nomePropriedade] || '';

  const dialogRef = this.dialog.open(AiFieldEditorComponent, {
    width: '900px', // Largura confortável
    disableClose: true, // Evita fechar clicando fora sem querer
    data: {
      fieldName: tituloCampo,
      currentValue: valorAtual,
      fullContext: this.getCleanLaudoJson() // Usa seu método existente para dar contexto
    }
  });

  dialogRef.afterClosed().subscribe(novoTexto => {
    if (novoTexto !== undefined) {
      // Atualiza o campo diretamente no objeto passado por referência
      objetoAlvo[nomePropriedade] = novoTexto;

      // Avisa o Angular para atualizar a tela
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