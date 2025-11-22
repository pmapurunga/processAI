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
import { QuesitosService } from '../../../core/services/quesitos.service'; // <--- Serviço de Quesitos

// Models
import { ModeloQuesito } from '../../../core/models/quesito.model'; // <--- Interface Atualizada

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
  private quesitosService = inject(QuesitosService); // Injeção do serviço
  private clipboard = inject(Clipboard);
  private snackBar = inject(MatSnackBar);
  private location = inject(Location);
  private cdr = inject(ChangeDetectorRef);

  laudoData: any = null;
  laudoBackup: any = null;
  processoId: string | null = null;

  private laudoSubscription: Subscription | null = null;

  // Controle do Modo de Edição
  isEditing = signal(false);

  // Ajuste no laudo$ para garantir atualização
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

  // --- Lógica das Diretrizes (Legado/Analise Geral) ---
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

  // --- NOVA LÓGICA DE AUTOMAÇÃO DE QUESITOS ---
  // Carrega os modelos diretamente do Firestore (já esperando que tenham o promptIA)
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

      const userContent = `
DADOS DO LAUDO:
${JSON.stringify(jsonLaudo, null, 2)}

DIRETRIZES SELECIONADAS:
${textoDiretrizes}

INSTRUÇÃO:
Use as diretrizes acima para fundamentar a análise.
      `;

      const response = await firstValueFrom(this.analysisService.generateLaudoAnalysis({
        model: 'gemini-2.5-pro',
        systemInstruction: promptConfig.prompt_text,
        userContent: userContent,
        temperature: 0.2
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

  // Passo 1: Aplica as perguntas do modelo na tela
  aplicarModeloQuesitos(modelo: ModeloQuesito) {
    this.modeloSelecionado.set(modelo);
    
    if (!this.laudoData.respostasQuesitos) {
      this.laudoData.respostasQuesitos = {};
    }

    let novosCampos = 0;
    // Ordena os quesitos para exibição correta
    const quesitosOrdenados = [...modelo.quesitos].sort((a, b) => a.ordem - b.ordem);

    quesitosOrdenados.forEach(q => {
      // Cria o campo no objeto de respostas usando o TEXTO da pergunta como chave (padrão atual)
      if (!this.laudoData.respostasQuesitos[q.texto]) {
        this.laudoData.respostasQuesitos[q.texto] = q.respostaPadrao || '';
        novosCampos++;
      }
    });
    
    this.showCopyMessage(`Modelo "${modelo.titulo}" aplicado!`);
  }

  // Passo 2: Envia para IA responder
  async responderQuesitosComIA() {
    const modelo = this.modeloSelecionado();

    if (!modelo) {
      this.showCopyMessage('Selecione um modelo primeiro.');
      return;
    }

    // Verifica se o prompt veio do Firestore
    if (!modelo.promptIA) {
      this.showCopyMessage('ERRO: Este modelo não possui Prompt de IA cadastrado no banco de dados.');
      return;
    }

    if (!this.processoId) return;

    this.isRespondendoQuesitos.set(true);

    try {
      const jsonLaudo = this.getCleanLaudoJson();

      // Monta o payload para o Gemini
      const userContent = `
      DADOS DO LAUDO PERICIAL:
      ${JSON.stringify(jsonLaudo, null, 2)}

      ---
      INSTRUÇÕES ESPECÍFICAS E FORMATAÇÃO (PROMPT DO MODELO):
      ${modelo.promptIA}

      ---
      FORMATO DE SAÍDA OBRIGATÓRIO (JSON):
      Retorne APENAS um JSON válido.
      As chaves devem ser os IDs dos quesitos (ex: "q1", "q4") e os valores as respostas geradas.
      Não use markdown (\`\`\`json). Apenas o objeto JSON.
      
      Exemplo de Saída:
      {
        "q4": "(X) Sim, e: Hipertensão...",
        "q5": "(X) Não."
      }
      `;

      // Chama a IA (usando Flash ou Pro conforme sua preferência no Service)
      const response = await firstValueFrom(this.analysisService.generateLaudoAnalysis({
        model: 'gemini-2.5-flash', 
        systemInstruction: "Você é um assistente pericial especializado em responder quesitos. Responda estritamente em JSON.",
        userContent: userContent,
        temperature: 0.1
      }));

      // Tenta decodificar o JSON
      let respostasIA: any = {};
      try {
        let cleanText = response.responseText
          .replace(/```json/g, '')
          .replace(/```/g, '')
          .trim();
        
        respostasIA = JSON.parse(cleanText);
      } catch (e) {
        console.error('Resposta IA inválida:', response.responseText);
        throw new Error('A IA não retornou um JSON válido.');
      }

      // Processa o retorno e atualiza a tela
      let atualizados = 0;
      
      modelo.quesitos.forEach(q => {
        const respostaGerada = respostasIA[q.id]; // Busca pela chave "q1", "q4"...
        
        if (respostaGerada) {
          // Atualiza o campo visual usando o Texto da Pergunta como chave
          this.laudoData.respostasQuesitos[q.texto] = respostaGerada;
          atualizados++;
        }
      });

      this.showCopyMessage(`${atualizados} quesitos respondidos pela IA!`);
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
      // Opcional: incluir respostasQuesitos antigos se necessário para contexto
    };
  }

  copyJsonToClipboard() {
    if (this.laudoData) {
      this.clipboard.copy(JSON.stringify(this.getCleanLaudoJson(), null, 2));
      this.showCopyMessage('JSON copiado!');
    }
  }

  copyPromptToClipboard() {
    const jsonString = JSON.stringify(this.getCleanLaudoJson(), null, 2);
    this.clipboard.copy("Use este JSON: " + jsonString);
    this.showCopyMessage('Dados copiados!');
  }
}