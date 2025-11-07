import { ChangeDetectionStrategy, Component, inject, Input } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';

@Component({
  standalone: true,
  selector: 'app-documentos-consolidados',
  imports: [
    CommonModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatExpansionModule,
  MatListModule,
    MatDividerModule,
  ],
  template: `
    <mat-toolbar color="primary">
      <button mat-icon-button (click)="goBack()" aria-label="Voltar">
        <mat-icon>arrow_back</mat-icon>
      </button>
      <span style="margin-left:8px; font-weight:600">Documentos Consolidados</span>
    </mat-toolbar>

    <div class="page-container" style="padding:16px;">
      <mat-card class="summary-card" style="margin-bottom:16px;">
        <mat-card-title>Resumo do Documento</mat-card-title>
        <mat-card-content>
          <div style="display:flex; gap:16px; flex-wrap:wrap;">
            <div class="chip-list" style="display:inline-block">
              <span class="chip" style="background:rgba(0,0,0,0.06); padding:6px 10px; border-radius:16px;">ID: {{ data.idDocumento || '-' }}</span>
            </div>
            <div style="min-width:220px;">
              <strong>Arquivo:</strong>
              <div>{{ data.nomeArquivoOriginal || '-' }}</div>
            </div>
            <div style="min-width:200px;">
              <strong>Classificação:</strong>
              <div>{{ data.tipoDocumentoGeral || '-' }}</div>
            </div>
            <div style="min-width:200px;">
              <strong>Período:</strong>
              <div>{{ data.periodoAnalisado || '-' }}</div>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-accordion multi>
        <mat-expansion-panel>
          <mat-expansion-panel-header>
            <mat-panel-title>Dados Relevantes para Laudo</mat-panel-title>
          </mat-expansion-panel-header>

          <div style="display:flex; gap:16px; flex-direction:column;">
            <mat-divider></mat-divider>

            <mat-expansion-panel *ngIf="data.dadosRelevantesParaLaudo?.identificacaoDasPartes">
              <mat-expansion-panel-header>
                <mat-panel-title>Identificação das Partes</mat-panel-title>
              </mat-expansion-panel-header>

              <div style="display:flex; gap:24px; flex-wrap:wrap;">
                <mat-card style="flex:1; min-width:300px;">
                  <mat-card-title>Polo Ativo</mat-card-title>
                  <mat-card-content>
                    <div><strong>Nome:</strong> {{ data.dadosRelevantesParaLaudo.identificacaoDasPartes.poloAtivo?.nome || '-' }}</div>
                    <div><strong>CPF:</strong> {{ data.dadosRelevantesParaLaudo.identificacaoDasPartes.poloAtivo?.cpf || '-' }}</div>
                    <div><strong>Nascimento:</strong> {{ data.dadosRelevantesParaLaudo.identificacaoDasPartes.poloAtivo?.dataNascimento || '-' }}</div>
                    <div><strong>Estado Civil:</strong> {{ data.dadosRelevantesParaLaudo.identificacaoDasPartes.poloAtivo?.estadoCivil || '-' }}</div>
                    <div><strong>Escolaridade:</strong> {{ data.dadosRelevantesParaLaudo.identificacaoDasPartes.poloAtivo?.escolaridade || '-' }}</div>
                    <div><strong>Endereço:</strong> {{ data.dadosRelevantesParaLaudo.identificacaoDasPartes.poloAtivo?.enderecoResidencial || '-' }}</div>
                    <div style="margin-top:8px;"><strong>Dados Consolidados:</strong>
                      <div>{{ data.dadosRelevantesParaLaudo.identificacaoDasPartes.poloAtivo?.dadosPessoaisConsolidados || '-' }}</div>
                    </div>
                  </mat-card-content>
                </mat-card>

                <mat-card style="flex:1; min-width:300px;">
                  <mat-card-title>Polo Passivo</mat-card-title>
                  <mat-card-content>
                    <div><strong>Nome:</strong> {{ data.dadosRelevantesParaLaudo.identificacaoDasPartes.poloPassivo?.nome || '-' }}</div>
                    <div><strong>CNPJ/Id:</strong> {{ data.dadosRelevantesParaLaudo.identificacaoDasPartes.poloPassivo?.cnpj || '-' }}</div>
                    <div style="margin-top:8px;"><strong>Dados Consolidados:</strong>
                      <div>{{ data.dadosRelevantesParaLaudo.identificacaoDasPartes.poloPassivo?.dadosGeraisConsolidados || '-' }}</div>
                    </div>
                  </mat-card-content>
                </mat-card>
              </div>
            </mat-expansion-panel>

            <mat-expansion-panel *ngIf="data.dadosRelevantesParaLaudo?.Vara">
              <mat-expansion-panel-header>
                <mat-panel-title>Tribunal / Vara</mat-panel-title>
              </mat-expansion-panel-header>
              <div><strong>Vara:</strong> {{ data.dadosRelevantesParaLaudo.Vara }}</div>
              <div><strong>Tribunal:</strong> {{ data.dadosRelevantesParaLaudo.Tribunal }}</div>
            </mat-expansion-panel>

            <mat-expansion-panel *ngIf="data.dadosRelevantesParaLaudo?.ResumoGeralDoCaso">
              <mat-expansion-panel-header>
                <mat-panel-title>Resumo Geral do Caso</mat-panel-title>
              </mat-expansion-panel-header>
              <p>{{ data.dadosRelevantesParaLaudo.ResumoGeralDoCaso }}</p>
            </mat-expansion-panel>

            <mat-expansion-panel *ngIf="data.dadosRelevantesParaLaudo?.historicoClinicoGeralConsolidado">
              <mat-expansion-panel-header>
                <mat-panel-title>Histórico Clínico Consolidado</mat-panel-title>
              </mat-expansion-panel-header>
              <p>{{ data.dadosRelevantesParaLaudo.historicoClinicoGeralConsolidado }}</p>
            </mat-expansion-panel>

            <mat-expansion-panel *ngIf="data.dadosRelevantesParaLaudo?.linhaDoTempoEventosRelevantes">
              <mat-expansion-panel-header>
                <mat-panel-title>Linha do Tempo</mat-panel-title>
              </mat-expansion-panel-header>
              <p>{{ data.dadosRelevantesParaLaudo.linhaDoTempoEventosRelevantes }}</p>
            </mat-expansion-panel>
          </div>
        </mat-expansion-panel>

        <mat-expansion-panel>
          <mat-expansion-panel-header>
            <mat-panel-title>Histórico Ocupacional Consolidado</mat-panel-title>
          </mat-expansion-panel-header>

          <div *ngIf="data.historicoOcupacionalConsolidado?.length; else noHistoric">
            <mat-list>
              <mat-list-item *ngFor="let h of data.historicoOcupacionalConsolidado; let i = index">
                <div style="width:100%">
                  <div style="display:flex; justify-content:space-between; align-items:center; gap:12px;">
                    <div>
                      <strong>{{ h.tipoOcupacao || ('Vínculo ' + (i+1)) }}</strong>
                      <div>{{ h.empresa || '-' }} — {{ h.ocupacao || '-' }}</div>
                      <div style="font-size:12px; color:rgba(0,0,0,0.7)">Período: {{ h.periodoFuncao || '-' }}</div>
                    </div>
                    <div style="display:flex; gap:6px;">
                      <span style="background:rgba(0,0,0,0.04); padding:4px 8px; border-radius:12px; font-size:12px">{{ h.ambienteFisico || '—' }}</span>
                      <span style="background:rgba(0,0,0,0.04); padding:4px 8px; border-radius:12px; font-size:12px">{{ h.ambientePsicossocial || '—' }}</span>
                    </div>
                  </div>
                  <div style="margin-top:8px">{{ h.descricaoFuncao || '' }}</div>
                </div>
              </mat-list-item>
            </mat-list>
          </div>
          <ng-template #noHistoric>
            <div style="padding:12px;">Nenhum histórico ocupacional consolidado encontrado.</div>
          </ng-template>
        </mat-expansion-panel>

        <mat-expansion-panel>
          <mat-expansion-panel-header>
            <mat-panel-title>Documentos Médicos Anexados</mat-panel-title>
          </mat-expansion-panel-header>

          <div *ngIf="data.documentosMedicosAnexados?.length; else noDocs">
            <mat-list>
              <mat-list-item *ngFor="let doc of data.documentosMedicosAnexados">
                <div style="width:100%">
                  <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                      <strong>{{ doc.tipo || '-' }}</strong>
                      <div style="font-size:13px">{{ doc.profissionalServico || '-' }} • {{ doc.data || '-' }}</div>
                    </div>
                    <div style="font-size:12px; color:rgba(0,0,0,0.6)">Pág. {{ doc.paginaNoArquivo || '—' }}</div>
                  </div>
                  <div style="margin-top:8px">{{ doc.resumoConteudo || '-' }}</div>
                </div>
              </mat-list-item>
            </mat-list>
          </div>
          <ng-template #noDocs>
            <div style="padding:12px">Nenhum documento médico listado.</div>
          </ng-template>
        </mat-expansion-panel>

        <mat-expansion-panel>
          <mat-expansion-panel-header>
            <mat-panel-title>Quesitos Apresentados</mat-panel-title>
          </mat-expansion-panel-header>

          <div *ngIf="data.quesitosApresentados?.length; else noQuesitos">
            <mat-list>
              <mat-list-item *ngFor="let q of data.quesitosApresentados">
                <div style="width:100%">
                  <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div><strong>{{ q.polo || '-' }}</strong></div>
                    <div style="font-size:12px; color:rgba(0,0,0,0.6)">Pág. {{ q.paginaNoArquivo || '—' }}</div>
                  </div>
                  <div style="margin-top:8px">{{ q.textoQuesito }}</div>
                </div>
              </mat-list-item>
            </mat-list>
          </div>
          <ng-template #noQuesitos>
            <div style="padding:12px">Nenhum quesito encontrado.</div>
          </ng-template>
        </mat-expansion-panel>

        <mat-expansion-panel>
          <mat-expansion-panel-header>
            <mat-panel-title>Observações</mat-panel-title>
          </mat-expansion-panel-header>
          <div style="padding:12px">{{ data.observacoes || '—' }}</div>
        </mat-expansion-panel>
      </mat-accordion>

    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentosConsolidadosComponent {
  private location = inject(Location);

  /** Se desejar passar o JSON dinamicamente (ex: via route resolver), injetar/atribuir aqui. */
  @Input() documentData: any | null = null;

  // Exemplo simples de dados para demo quando nenhum JSON for passado
  sampleData = {
    idDocumento: 'exemplo-001',
    nomeArquivoOriginal: 'processo_exemplo.pdf',
    tipoDocumentoGeral: 'Autos Processuais Completos',
    periodoAnalisado: '01/01/2020 - 31/12/2022',
    dadosRelevantesParaLaudo: {
      identificacaoDasPartes: {
        poloAtivo: {
          nome: 'Fulano de Tal',
          cpf: '000.000.000-00',
          dataNascimento: '01/01/1980',
          estadoCivil: 'Casado',
          escolaridade: 'Ensino Médio',
          enderecoResidencial: 'Rua Exemplo, 123',
          dadosPessoaisConsolidados: 'Nasc. 01/01/1980, 42 anos, casado, Ensino Médio',
        },
        poloPassivo: {
          nome: 'Empresa X',
          cnpj: '00.000.000/0001-00',
          dadosGeraisConsolidados: 'Endereço Empresa X, Ramo: Indústria'
        }
      },
      Vara: '1a Vara Federal da SSJ de Feira de Santana-BA',
      Tribunal: 'TRF1',
      ResumoGeralDoCaso: 'Ação trabalhista cujo pedido principal é ...',
      historicoClinicoGeralConsolidado: 'Comorbidades: hipertensão; cirurgias: apendicectomia',
      linhaDoTempoEventosRelevantes: '01/2020 - início dos sintomas; 03/2020 - afastamento; ...'
    },
    historicoOcupacionalConsolidado: [
      {
        tipoOcupacao: 'Vínculo em questão',
        empresa: 'Empresa X',
        ocupacao: 'Operador',
        descricaoFuncao: 'Operava máquina X, exposição a ruído e calor',
        periodoFuncao: '01/2010 a 12/2020',
        ambienteFisico: 'Ruído, calor, agentes químicos',
        ambientePsicossocial: 'Pressão por metas',
        jornadaTrabalho: '44h semanais, turno noite',
        treinamentoEPIs: 'Treinamento anual e EPI fornecido',
        afastamentosECATs: 'CAT nº 12345'
      }
    ],
    documentosMedicosAnexados: [
      {
        tipo: 'Laudo de Exame',
        data: '10/03/2021',
        profissionalServico: 'Clínica Y',
        resumoConteudo: 'CID: M54.5; achados: degeneração discal lombar',
        paginaNoArquivo: 12
      }
    ],
    quesitosApresentados: [
      { polo: 'Ativo', textoQuesito: 'O perito pode informar se...', paginaNoArquivo: 45 }
    ],
    observacoes: 'Páginas 78-79 manuscritas parcialmente ilegíveis.'
  };

  get data() {
    return this.documentData || this.sampleData;
  }

  goBack(): void {
    this.location.back();
  }
}
