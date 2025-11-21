import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { map, switchMap, tap } from 'rxjs';
import { FirestoreService } from '../../../core/services/firestore.service';
import { CommonModule, Location } from '@angular/common';
import { Clipboard } from '@angular/cdk/clipboard';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
// Serviços
import { DiretrizesService, Diretriz } from '../../../core/services/diretrizes.service';
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
export class LaudoPericialComponent {
  private route = inject(ActivatedRoute);
  private firestoreService = inject(FirestoreService);
  private diretrizesService = inject(DiretrizesService);
  private clipboard = inject(Clipboard);
  private snackBar = inject(MatSnackBar);
  private location = inject(Location);

  laudoData: any = null;

  // Carrega o Laudo do Firestore
  laudo$ = this.route.paramMap.pipe(
        map(params => params.get('id')),

    switchMap(id => { 
      if (!id) {
        return [];
      }
            return this.firestoreService.getLaudoPericial(id);
    }),
    tap(laudo => this.laudoData = laudo)
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

  objectKeys(obj: any): string[] {
    return Object.keys(obj || {});
  }

  goBack(): void {
    this.location.back();
  }

  private showCopyMessage(message: string) {
    this.snackBar.open(message, 'Fechar', {
      duration: 2000,
    });
  }

  // Função simulada para analisar com IA
  async analisarComIA() {
    if (this.diretrizesSelecionadas().length === 0) {
      this.showCopyMessage('Selecione pelo menos uma diretriz.');
      return;
    }

    this.isAnalisando.set(true);
    this.resultadoAnaliseIA.set(null);

    // Simulação de chamada à IA (Substituir por chamada real depois)
    setTimeout(() => {
      this.resultadoAnaliseIA.set(`
### Análise Preliminar Baseada nas Diretrizes

**Diretrizes Aplicadas:**
${this.diretrizesSelecionadas().map(d => `* ${d.nome}`).join('\n')}

**Parecer Sugerido:**
Com base na documentação médica apresentada e nas diretrizes selecionadas, observa-se compatibilidade técnica com os critérios estabelecidos. A patologia descrita no laudo encontra correspondência nos requisitos da norma selecionada, sugerindo nexo técnico.

*(Esta é uma resposta simulada. A integração real será criada posteriormente.)*
      `);
      this.isAnalisando.set(false);
    }, 2000);
  }

  // Função auxiliar para atualizar as diretrizes (necessária pois o HTML não aceita arrow functions)
  atualizarDiretrizes(opcoes: any[]) {
    // Mapeia as opções para pegar apenas o valor (a diretriz em si)
    const valores = opcoes.map(opcao => opcao.value);
    this.diretrizesSelecionadas.set(valores);
  }

  // Copiar JSON
  copyJsonToClipboard() {
    if (this.laudoData) {
      const filteredLaudo = {
        identificacaoProcesso: {
          PROCESSO_NUM: this.laudoData.identificacaoProcesso?.PROCESSO_NUM ?? null,
          JUIZO: this.laudoData.identificacaoProcesso?.JUIZO ?? null,
          NOME_PERICIANDO: this.laudoData.identificacaoProcesso?.NOME_PERICIANDO ?? null,
          DATA_EXAME: this.laudoData.identificacaoProcesso?.DATA_EXAME ?? null
        },
        dadosPericiando: {
          DATA_NASCIMENTO: this.laudoData.dadosPericiando?.DATA_NASCIMENTO ?? null,
          SEXO: this.laudoData.dadosPericiando?.SEXO ?? null,
          ESTADO_CIVIL: this.laudoData.dadosPericiando?.ESTADO_CIVIL ?? null,
          ESCOLARIDADE: this.laudoData.dadosPericiando?.ESCOLARIDADE ?? null
        },
        historicoLaboral: {
          FUNCAO_HABITUAL_ATUAL: {
            descricao: this.laudoData.historicoLaboral?.FUNCAO_HABITUAL_ATUAL?.descricao ?? null,
            vinculo: this.laudoData.historicoLaboral?.FUNCAO_HABITUAL_ATUAL?.vinculo ?? null,
            periodo: this.laudoData.historicoLaboral?.FUNCAO_HABITUAL_ATUAL?.periodo ?? null
          },
          TEMPO_TOTAL_ATIVIDADE: this.laudoData.historicoLaboral?.TEMPO_TOTAL_ATIVIDADE ?? null,
          DATA_AFASTAMENTO_DECLARADA: this.laudoData.historicoLaboral?.DATA_AFASTAMENTO_DECLARADA ?? null,
          HISTORICO_OCUPACIONAL_COMPLETO: this.laudoData.historicoLaboral?.HISTORICO_OCUPACIONAL_COMPLETO ?? null,
          EXPERIENCIAS_LABORAIS_ANTERIORES: this.laudoData.historicoLaboral?.EXPERIENCIAS_LABORAIS_ANTERIORES ?? [],
          PROFISSIOGRAFIA: {
            atividade_analisada: this.laudoData.historicoLaboral?.PROFISSIOGRAFIA?.atividade_analisada ?? null,
            tarefas_executadas: this.laudoData.historicoLaboral?.PROFISSIOGRAFIA?.tarefas_executadas ?? null,
            postura_corporal: this.laudoData.historicoLaboral?.PROFISSIOGRAFIA?.postura_corporal ?? null,
            movimentos_repetitivos: this.laudoData.historicoLaboral?.PROFISSIOGRAFIA?.movimentos_repetitivos ?? null,
            carga_fisica: this.laudoData.historicoLaboral?.PROFISSIOGRAFIA?.carga_fisica ?? null,
            ambiente_trabalho: this.laudoData.historicoLaboral?.PROFISSIOGRAFIA?.ambiente_trabalho ?? null,
            exigencias_fisicas: this.laudoData.historicoLaboral?.PROFISSIOGRAFIA?.exigencias_fisicas ?? null,
            equipamentos_utilizados: this.laudoData.historicoLaboral?.PROFISSIOGRAFIA?.equipamentos_utilizados ?? null,
            SUMARIO_PROFISSIOGRAFICO: this.laudoData.historicoLaboral?.PROFISSIOGRAFIA?.SUMARIO_PROFISSIOGRAFICO ?? null
          }
        },
        dadosMedicos: {
          HISTORIA_CLINICA: this.laudoData.dadosMedicos?.HISTORIA_CLINICA ?? null,
          EXAMES: this.laudoData.dadosMedicos?.EXAMES ?? null,
          EXAME_CLINICO: this.laudoData.dadosMedicos?.EXAME_CLINICO ?? null
        },
        OBSERVACOES: this.laudoData.OBSERVACOES ?? null,
        respostasQuesitos: this.laudoData.respostasQuesitos ?? {},
        dadosLaudo: {
          DIA_LAUDO: this.laudoData.dadosLaudo?.DIA_LAUDO ?? null,
          MES_LAUDO: this.laudoData.dadosLaudo?.MES_LAUDO ?? null,
          ANO_LAUDO: this.laudoData.dadosLaudo?.ANO_LAUDO ?? null
        }
      };

      const jsonString = JSON.stringify(filteredLaudo, null, 2);
      this.clipboard.copy(jsonString);
      this.showCopyMessage('JSON copiado para a área de transferência!');
    }
  }

  // Copiar Prompt
  copyPromptToClipboard() {
    if (this.laudoData) {
      const prompt = `**Comando Principal:**

Você é "Perícias Médica Federal", um Médico do Trabalho e Perito Médico Federal. Sua atuação deve ser pautada estritamente pelas diretrizes de elaboração de laudo, pelo Decreto Nº 3.048/1999, pela Portaria Interministerial MTP/MS Nº 22/2022 e pela Lei Nº 13.146/2015 (Estatuto da Pessoa com Deficiência).

Sua tarefa é elaborar um Laudo Médico Pericial completo e fundamentado, utilizando exclusivamente as informações fornecidas no seguinte JSON. Você deve seguir rigorosamente a estrutura de laudo solicitada, preenchendo cada seção de forma objetiva, clara e assertiva.

**Diretrizes de Estilo e Conteúdo:**

1.  **Objetividade e Assertividade:** Apresente a conclusão seguida da explicação, evitando redundância.
2.  **Análise Biopsicossocial:** Avalie o caso de forma holística, considerando não apenas o diagnóstico, mas também o contexto social do periciando (idade, escolaridade, histórico laboral) e as exigências de sua profissão (profissiografia).
3.  **Fundamentação:** Baseie todas as afirmações e conclusões nos documentos e informações fornecidos no JSON. Não realize pesquisas externas nem presuma informações não declaradas.
4.  **Respostas aos Quesitos:** Responda aos quesitos judiciais quando você for indagado, justificando cada resposta com base na análise do caso. Defina as datas técnicas (DID, DII) e justifique a conclusão sobre a existência, grau e temporalidade da incapacidade. No momento não faça nenhuma resposta aos quesitos pois eu irei colocar posteriormente os quesitos para serem preenchidos.
5.  **Análise Crítica:** Seja ponderado ao avaliar a relação entre os diagnósticos e a incapacidade laboral, identificando tanto as limitações reais quanto possíveis inconsistências, sem supervalorizar ou desvalorizar os achados. Utilize o valor presente no campo "OBSERVACOES" para fazer suas análises.

**Estrutura do Laudo a ser Gerado:**

1.  IDENTIFICAÇÃO DO PROCESSO
2.  DADOS DO(A) PERICIANDO(A)
3.  HISTÓRICO LABORAL (incluindo Profissiografia detalhada)
4.  DADOS MÉDICOS (História Clínica, resumo dos Exames e Exame Clínico)
5.  RESPOSTAS AOS QUESITOS (Responder ao que for pedido)

**Dados de Entrada (JSON):**

#JSON_de_Entrada#

**Ação:**

Execute a tarefa e gere o Laudo Médico Pericial fazendo a transcrição literal de todos os dados presentes dentro do JSON de Entrada. Me mostre como ficou cada campo. Ao final, me mostre como está o campo "OBSERVACOES"`;

      const filteredLaudo = {
        identificacaoProcesso: {
          PROCESSO_NUM: this.laudoData.identificacaoProcesso?.PROCESSO_NUM ?? null,
          JUIZO: this.laudoData.identificacaoProcesso?.JUIZO ?? null,
          NOME_PERICIANDO: this.laudoData.identificacaoProcesso?.NOME_PERICIANDO ?? null,
          DATA_EXAME: this.laudoData.identificacaoProcesso?.DATA_EXAME ?? null
        },
        dadosPericiando: {
          DATA_NASCIMENTO: this.laudoData.dadosPericiando?.DATA_NASCIMENTO ?? null,
          SEXO: this.laudoData.dadosPericiando?.SEXO ?? null,
          ESTADO_CIVIL: this.laudoData.dadosPericiando?.ESTADO_CIVIL ?? null,
          ESCOLARIDADE: this.laudoData.dadosPericiando?.ESCOLARIDADE ?? null
        },
        historicoLaboral: {
          FUNCAO_HABITUAL_ATUAL: {
            descricao: this.laudoData.historicoLaboral?.FUNCAO_HABITUAL_ATUAL?.descricao ?? null,
            vinculo: this.laudoData.historicoLaboral?.FUNCAO_HABITUAL_ATUAL?.vinculo ?? null,
            periodo: this.laudoData.historicoLaboral?.FUNCAO_HABITUAL_ATUAL?.periodo ?? null
          },
          TEMPO_TOTAL_ATIVIDADE: this.laudoData.historicoLaboral?.TEMPO_TOTAL_ATIVIDADE ?? null,
          DATA_AFASTAMENTO_DECLARADA: this.laudoData.historicoLaboral?.DATA_AFASTAMENTO_DECLARADA ?? null,
          HISTORICO_OCUPACIONAL_COMPLETO: this.laudoData.historicoLaboral?.HISTORICO_OCUPACIONAL_COMPLETO ?? null,
          EXPERIENCIAS_LABORAIS_ANTERIORES: this.laudoData.historicoLaboral?.EXPERIENCIAS_LABORAIS_ANTERIORES ?? [],
          PROFISSIOGRAFIA: {
            atividade_analisada: this.laudoData.historicoLaboral?.PROFISSIOGRAFIA?.atividade_analisada ?? null,
            tarefas_executadas: this.laudoData.historicoLaboral?.PROFISSIOGRAFIA?.tarefas_executadas ?? null,
            postura_corporal: this.laudoData.historicoLaboral?.PROFISSIOGRAFIA?.postura_corporal ?? null,
            movimentos_repetitivos: this.laudoData.historicoLaboral?.PROFISSIOGRAFIA?.movimentos_repetitivos ?? null,
            carga_fisica: this.laudoData.historicoLaboral?.PROFISSIOGRAFIA?.carga_fisica ?? null,
            ambiente_trabalho: this.laudoData.historicoLaboral?.PROFISSIOGRAFIA?.ambiente_trabalho ?? null,
            exigencias_fisicas: this.laudoData.historicoLaboral?.PROFISSIOGRAFIA?.exigencias_fisicas ?? null,
            equipamentos_utilizados: this.laudoData.historicoLaboral?.PROFISSIOGRAFIA?.equipamentos_utilizados ?? null,
            SUMARIO_PROFISSIOGRAFICO: this.laudoData.historicoLaboral?.PROFISSIOGRAFIA?.SUMARIO_PROFISSIOGRAFICO ?? null
          }
        },
        dadosMedicos: {
          HISTORIA_CLINICA: this.laudoData.dadosMedicos?.HISTORIA_CLINICA ?? null,
          EXAMES: this.laudoData.dadosMedicos?.EXAMES ?? null,
          EXAME_CLINICO: this.laudoData.dadosMedicos?.EXAME_CLINICO ?? null
        },
        OBSERVACOES: this.laudoData.OBSERVACOES ?? null,
        respostasQuesitos: this.laudoData.respostasQuesitos ?? {},
        dadosLaudo: {
          DIA_LAUDO: this.laudoData.dadosLaudo?.DIA_LAUDO ?? null,
          MES_LAUDO: this.laudoData.dadosLaudo?.MES_LAUDO ?? null,
          ANO_LAUDO: this.laudoData.dadosLaudo?.ANO_LAUDO ?? null
        }
      };

      const jsonString = JSON.stringify(filteredLaudo, null, 2);
      const finalContentToCopy = prompt.replace('#JSON_de_Entrada#', jsonString);

      this.clipboard.copy(finalContentToCopy);
      this.showCopyMessage('Laudo Pericial copiado para a área de transferência!');
    }
  }
}