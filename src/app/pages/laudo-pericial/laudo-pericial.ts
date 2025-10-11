
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { map, switchMap, tap } from 'rxjs';
import { FirestoreService } from '../../firestore.service';
import { CommonModule } from '@angular/common';
import { Clipboard } from '@angular/cdk/clipboard';
import { MarkdownModule } from 'ngx-markdown';

@Component({
  selector: 'app-laudo-pericial',
  templateUrl: './laudo-pericial.html',
  styleUrls: ['./laudo-pericial.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MarkdownModule]
})
export class LaudoPericialComponent {
  private route = inject(ActivatedRoute);
  private firestoreService = inject(FirestoreService);
  private clipboard = inject(Clipboard);

  laudoData: any = null;
  copyButtonText = signal('Copiar JSON de laudo_pericial');

  laudo$ = this.route.paramMap.pipe(
    map(params => params.get('numero_processo')),
    switchMap(numero_processo => {
      if (!numero_processo) {
        return [];
      }
      return this.firestoreService.getLaudoPericial(numero_processo);
    }),
    tap(laudo => this.laudoData = laudo)
  );

  objectKeys(obj: any): string[] {
    return Object.keys(obj || {});
  }

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
        respostasQuesitos: this.laudoData.respostasQuesitos ?? {},
        dadosLaudo: {
          DIA_LAUDO: this.laudoData.dadosLaudo?.DIA_LAUDO ?? null,
          MES_LAUDO: this.laudoData.dadosLaudo?.MES_LAUDO ?? null,
          ANO_LAUDO: this.laudoData.dadosLaudo?.ANO_LAUDO ?? null
        }
      };

      const jsonString = JSON.stringify(filteredLaudo, null, 2);
      this.clipboard.copy(jsonString);
      this.copyButtonText.set('Copiado!');
      setTimeout(() => this.copyButtonText.set('Copiar JSON de laudo_pericial'), 2000);
    }
  }
}
