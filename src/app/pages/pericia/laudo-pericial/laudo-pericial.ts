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

  // --- PERSONAS ---
  listaPersonas = toSignal(this.personasService.getPersonas(true), { initialValue: [] });
  personaSelecionada = signal<Persona | null>(null);

  // --- Automação de Quesitos ---
  listaModelosQuesitos = toSignal(this.quesitosService.getModelos(), { initialValue: [] });
  modeloSelecionado = signal<ModeloQuesito | null>(null);
  isRespondendoQuesitos = signal(false);

  // --- Diretrizes (Analise Geral) ---
  todasDiretrizes = toSignal(this.diretrizesService.getDiretrizes(), { initialValue: [] });
  filtroJustica = signal<'Justiça Federal' | 'Justiça do Trabalho' | 'Justiça Comum'>('Justiça Federal');

  // Signal para armazenar o termo digitado na busca
  termoBuscaDiretrizes = signal('');

  // Computed que filtra por Justiça E pelo texto da busca
  diretrizesFiltradas = computed(() => {
    const lista = this.todasDiretrizes();
    const filtro = this.filtroJustica();
    const busca = this.termoBuscaDiretrizes().toLowerCase().trim();

    return lista.filter(d => {
      const matchJustica = d.justica === filtro;
      const matchTexto = !busca ||
                         d.nome.toLowerCase().includes(busca) ||
                         (d.conteudo && d.conteudo.toLowerCase().includes(busca));
      return matchJustica && matchTexto;
    });
  });

  diretrizesSelecionadas = signal<Diretriz[]>([]);
  resultadoAnaliseIA = signal<string | null>(null);
  isAnalisando = signal(false);

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

      // 1. Restaura o Texto da IA
      if (laudo && laudo.analiseIA) {
        this.resultadoAnaliseIA.set(laudo.analiseIA);
      }

      // 2. Restaura a seleção das diretrizes baseada no que foi salvo
      if (laudo && laudo.diretrizesUsadasAnalise && Array.isArray(laudo.diretrizesUsadasAnalise)) {
        const todas = this.todasDiretrizes();
        const idsSalvos = laudo.diretrizesUsadasAnalise.map((d: any) => d.id);
        const diretrizesParaRestaurar = todas.filter(d => idsSalvos.includes(d.id));

        if (diretrizesParaRestaurar.length > 0) {
          this.diretrizesSelecionadas.set(diretrizesParaRestaurar);
        }
      }

      // 3. Restaura Contexto de Quesitos (Modelo e Persona)
      if (laudo) {
        // Restaura Modelo
        if (laudo.modeloQuesitoId) {
          const modeloFound = this.listaModelosQuesitos().find(m => m.id === laudo.modeloQuesitoId);
          if (modeloFound) {
            this.modeloSelecionado.set(modeloFound);
          }
        }

        // Restaura Persona usada nos Quesitos
        if (laudo.personaQuesitosId) {
           const personaFound = this.listaPersonas().find(p => p.id === laudo.personaQuesitosId);
           if (personaFound) {
             this.personaSelecionada.set(personaFound);
           }
        }
      }

      this.cdr.markForCheck();
    })
  );

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

  // NOVO MÉTODO: Ordenação numérica das chaves dos quesitos
  getQuesitosKeysOrdenadas(): string[] {
    if (!this.laudoData || !this.laudoData.respostasQuesitos) return [];

    return Object.keys(this.laudoData.respostasQuesitos).sort((a, b) => {
      // Extrai apenas os números das chaves (ex: "RESPOSTA_QUESITO_10" -> 10)
      const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
      return numA - numB;
    });
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
      const promptConfig = await firstValueFrom(this.promptService.getPromptById('analise_federal'));

      if (!promptConfig || !promptConfig.prompt_text) {
        throw new Error('Prompt "analise_federal" não encontrado.');
      }

      const jsonLaudo = this.getCleanLaudoJson();
      const textoDiretrizes = this.diretrizesSelecionadas()
        .map(d => `--- DIRETRIZ (${d.nome}) ---\n${d.conteudo || 'SEM CONTEÚDO'}`)
        .join('\n\n');

      const persona = this.personaSelecionada();
      let systemInstruction = promptConfig.prompt_text;
      let knowledgeContext = '';
      let taskInstruction = '';

      if (persona) {
        systemInstruction = persona.instrucoes;
        knowledgeContext = this.montarContextoConhecimento(persona);
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

      const diretrizesSnapshot = this.diretrizesSelecionadas().map(d => ({
        id: d.id,
        nome: d.nome,
        justica: d.justica
      }));

      await this.firestoreService.updateLaudoPericial(this.processoId, {
        analiseIA: textoGerado,
        diretrizesUsadasAnalise: diretrizesSnapshot
      });

      this.resultadoAnaliseIA.set(textoGerado);

      if (this.laudoData) {
        this.laudoData.analiseIA = textoGerado;
        this.laudoData.diretrizesUsadasAnalise = diretrizesSnapshot;
      }

      this.showCopyMessage('Análise realizada e salva com sucesso!');

    } catch (error: any) {
      console.error('Erro IA:', error);
      this.showCopyMessage('Falha ao analisar.');
    } finally {
      this.isAnalisando.set(false);
      this.cdr.markForCheck();
    }
  }

  isDiretrizSelected(diretriz: Diretriz): boolean {
    return this.diretrizesSelecionadas().some(d => d.id === diretriz.id);
  }

  toggleDiretrizSelection(event: MatSelectionListChange) {
    const changedOption = event.options[0];
    const diretriz = changedOption.value;
    const isSelected = changedOption.selected;

    const listaAtual = [...this.diretrizesSelecionadas()];

    if (isSelected) {
      if (!listaAtual.some(d => d.id === diretriz.id)) {
        listaAtual.push(diretriz);
      }
    } else {
      const index = listaAtual.findIndex(d => d.id === diretriz.id);
      if (index !== -1) {
        listaAtual.splice(index, 1);
      }
    }

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
     console.log('🚀 --- INICIANDO PROCESSAMENTO DE QUESITOS COM IA ---');

     const modelo = this.modeloSelecionado();

     // 1. Validações iniciais
     if (!modelo) {
       console.warn('⚠️ Nenhum modelo de quesito selecionado.');
       this.showCopyMessage('Selecione um modelo primeiro.');
       return;
     }

     if (!modelo.promptIA) {
       console.warn('⚠️ Modelo sem prompt de IA configurado:', modelo.titulo);
       this.showCopyMessage('ERRO: Este modelo não possui Prompt de IA cadastrado.');
       return;
     }

     if (!this.processoId) {
       console.error('❌ ID do processo não encontrado.');
       return;
     }

     this.isRespondendoQuesitos.set(true);

     try {
       // 2. Preparação dos Dados
       const baseJson = this.getCleanLaudoJson();

       // Cópia para manipulação
       const jsonParaIA = JSON.parse(JSON.stringify(baseJson));

       // 3. LIMPEZA (Remove respostas antigas para não enviesar)
       delete jsonParaIA.respostasQuesitos;
       delete jsonParaIA.meta_dados_quesitos;

       // 4. INJEÇÃO DE CONTEXTO E DIRETRIZES

       // A. Resumo da Análise (Bússola Lógica)
       if (this.laudoData.analiseIA) {
         console.log('✅ Análise Prévia (Resumo) encontrada e injetada.');
         jsonParaIA.ANALISE_DIRETRIZES_PREVIA = this.laudoData.analiseIA;
       } else {
         console.log('ℹ️ Sem Análise Prévia disponível no laudo.');
       }

       // B. Texto Completo das Diretrizes (Base Legal)
       const diretrizesAtivas = this.diretrizesSelecionadas();
       console.log(`📋 Diretrizes Selecionadas: ${diretrizesAtivas.length}`, diretrizesAtivas.map(d => d.nome));

       const textoDiretrizes = diretrizesAtivas
         .map(d => `--- NORMA/DIRETRIZ (${d.nome}) ---\n${d.conteudo || 'SEM CONTEÚDO'}`)
         .join('\n\n');

       if (textoDiretrizes) {
         jsonParaIA.CONTEUDO_DIRETRIZES_COMPLETO = textoDiretrizes;
         console.log('✅ Conteúdo completo das diretrizes injetado no JSON.');
       }

       // LOG: O que a IA vai ler
       console.log('📦 JSON DE CONTEXTO (DADOS + DIRETRIZES):', jsonParaIA);

       // 5. Configuração do Prompt (Persona + Instruções)
       const persona = this.personaSelecionada();
       let systemInstruction = "Você é um assistente pericial. Responda estritamente em JSON.";
       let knowledgeContext = '';

       if (persona) {
         console.log('👤 Persona aplicada:', persona.nome);
         systemInstruction = persona.instrucoes + " IMPORTANTE: A saída DEVE ser estritamente um JSON válido.";
         knowledgeContext = this.montarContextoConhecimento(persona);
       } else {
         console.log('👤 Nenhuma Persona selecionada (usando padrão).');
       }

       // PROMPT COM A "REGRA DE OURO" E INSTRUÇÃO DE FORMATO
       const userContent = `
       ${knowledgeContext}

       === CONTEXTO COMPLETO DO CASO ===
       Abaixo estão os dados do periciando e a ANÁLISE TÉCNICA PRÉVIA (analiseIA) que define a conclusão do caso.

       ${JSON.stringify(jsonParaIA, null, 2)}

       ---
       🚨 REGRA DE OURO (RACIOCÍNIO OBRIGATÓRIO):
       O campo "ANALISE_DIRETRIZES_PREVIA" contém a conclusão pericial macroscópica já definida.
       1. Você deve ADOTAR essa análise como a verdade absoluta do caso.
       2. Todas as respostas aos quesitos devem DERIVAR logicamente dessa análise.
       3. SE a análise diz que "não há incapacidade", é PROIBIDO responder qualquer quesito dizendo que "há incapacidade". Mantenha a coerência total.
       4. Use o "CONTEUDO_DIRETRIZES_COMPLETO" para citar trechos de leis/normas quando solicitado.

       ---
       TAREFA (RESPONDER QUESITOS):
       ${modelo.promptIA}

       ---
       FORMATO DE SAÍDA OBRIGATÓRIO (JSON):
       Retorne APENAS um objeto JSON onde:
       1. As chaves devem seguir o padrão solicitado no prompt (ex: "RESPOSTA_QUESITO_4").
       2. Os valores são as respostas em TEXTO PLANO (String).
       3. NÃO crie objetos dentro das respostas.
       `;

       // LOG DO PROMPT (Útil para debug manual)
       console.log('📝 PROMPT ENVIADO:', userContent);

       // 6. Chamada à API
       console.log('⏳ Aguardando resposta do Gemini...');
       const response = await firstValueFrom(this.analysisService.generateLaudoAnalysis({
         model: 'gemini-2.5-pro',
         systemInstruction: systemInstruction,
         userContent: userContent,
         temperature: 0.2, // Temperatura baixa para maior fidelidade às regras
         responseMimeType: 'application/json',
         processId: this.processoId!,
         actionContext: `resposta_quesitos_modelo_${modelo.id}`
       }));

       console.log('📩 Resposta bruta recebida:', response.responseText);

       // 7. Tratamento da Resposta
       let respostasIA: any = {};
       try {
         respostasIA = JSON.parse(response.responseText);
         console.log('✅ JSON parseado com sucesso:', respostasIA);
       } catch (e) {
         console.error('❌ Falha ao fazer parse do JSON retornado:', response.responseText);
         throw new Error('A IA não retornou um JSON válido.');
       }

       let atualizados = 0;

       // 8. Aplicação das Respostas (Lógica Híbrida: Chave Longa vs ID Curto)
       modelo.quesitos.forEach(q => {
         // A. Descobre o número (ex: "q4" -> "4")
         const numero = q.id.replace(/\D/g, '');

         // B. Monta a chave técnica esperada pelo HTML (ex: "RESPOSTA_QUESITO_4")
         const chaveTecnica = `RESPOSTA_QUESITO_${numero}`;

         // C. Tenta ler a resposta em ambos os formatos possíveis
         // Prioridade: Chave longa (RESPOSTA_QUESITO_4) > ID (q4)
         let respostaGerada = respostasIA[chaveTecnica] || respostasIA[q.id];

         if (respostaGerada) {
           // Sanitização: Garante que é string e não objeto/null
           if (typeof respostaGerada === 'object' && respostaGerada !== null) {
             const valores = Object.values(respostaGerada);
             respostaGerada = valores.length > 0 ? String(valores[0]) : JSON.stringify(respostaGerada);
           }

           if (typeof respostaGerada !== 'string') {
              respostaGerada = String(respostaGerada);
           }

           // Salva no laudo usando a chave correta para o formulário
           this.laudoData.respostasQuesitos[chaveTecnica] = respostaGerada;
           atualizados++;

           console.log(`✅ Quesito ${numero} preenchido.`);
         } else {
           console.warn(`⚠️ Resposta ausente para Quesito ${numero} (Chaves verificadas: ${chaveTecnica}, ${q.id})`);
         }
       });

       console.log(`🏁 Processo finalizado. Total de quesitos respondidos: ${atualizados}`);

       // 9. Salvar no Firestore
       await this.firestoreService.updateLaudoPericial(this.processoId, {
         respostasQuesitos: this.laudoData.respostasQuesitos,
         modeloQuesitoId: this.laudoData.modeloQuesitoId,
         personaQuesitosId: this.personaSelecionada()?.id || null
       });

       this.showCopyMessage(`${atualizados} quesitos respondidos com base na análise e diretrizes!`);
       this.cdr.markForCheck();

     } catch (error: any) {
       console.error('❌ Erro Crítico ao processar quesitos:', error);
       this.showCopyMessage('Erro ao gerar respostas: ' + error.message);
     } finally {
       this.isRespondendoQuesitos.set(false);
     }
   }

    // Mantenha o getCleanLaudoJson original ou genérico, pois ele serve para outras coisas
    private getCleanLaudoJson(): any {
      if (!this.laudoData) return {};
      const { respostasQuesitos, ...rest } = this.laudoData;
      return {
        identificacaoProcesso: rest.identificacaoProcesso,
        dadosPericiando: rest.dadosPericiando,
        historicoLaboral: rest.historicoLaboral,
        dadosMedicos: rest.dadosMedicos,
        OBSERVACOES: rest.OBSERVACOES,
        respostasQuesitos: rest.respostasQuesitos, // Aqui mantemos, pois pode ser usado para copiar JSON completo
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

  // --- NOVO MÉTODO PARA ANÁLISE IA ---
  melhorarAnaliseIA() {
    const valorAtual = this.resultadoAnaliseIA() || '';

    const dialogRef = this.dialog.open(AiFieldEditorComponent, {
      width: '900px',
      disableClose: true,
      data: {
        fieldName: 'Análise da IA',
        currentValue: valorAtual,
        fullContext: this.getCleanLaudoJson()
      }
    });

    dialogRef.afterClosed().subscribe(novoTexto => {
      if (novoTexto !== undefined) {
        this.resultadoAnaliseIA.set(novoTexto);
        if (this.laudoData) {
            this.laudoData.analiseIA = novoTexto;
        }
        this.cdr.markForCheck();
        this.showCopyMessage('Análise atualizada com IA!');
      }
    });
  }

  copyPromptToClipboard() {
    const jsonString = JSON.stringify(this.getCleanLaudoJson(), null, 2);
    this.clipboard.copy("Use este JSON: " + jsonString);
    this.showCopyMessage('Dados copiados!');
  }
}
