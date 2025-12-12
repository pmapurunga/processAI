import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, switchMap } from 'rxjs';
import { doc, docData, Firestore } from '@angular/fire/firestore';
import { Observable, of } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';

interface ProcessAnalysis {
  status?: string;
  progresso?: number;
  metadadosConsolidacao?: {
    numeroProcesso: string;
    dataUltimaMovimentacao: string;
    dataExamePericial: string;
    quantidadeArquivosAnalisados: number;
    periodoCoberto: {
      inicio: string;
      fim: string;
    };
  };

  // --- NOVO CAMPO: Monitoramento de IA ---
  usoIA?: {
    totalInput: number;
    totalOutput: number;
    custoTotal: number;
    ultimaAtualizacao: any; // Timestamp do Firestore
  };
  // --------------------------------------

  dadosCadastrais?: {
    autor: {
      nomeCompleto: string;
      cpf: string;
      nascimento: string;
      sexo: string;
      estadoCivil: string;
      escolaridade: string;
      endereco: string;
    };
    reu: {
      nome: string;
      cnpj: string | null;
      atividadePrincipal: string | null;
    };
    orgaoJulgador: {
      vara: string;
      tribunal: string;
    };
  };
  resumoProcessual?: {
    objetoDaAcao: string;
    teseInicial: string;
    teseDefesa: string;
    statusAtual: string;
    linhaDoTempoEventos: {
      data: string;
      evento: string;
    }[];
  };
  saudeConsolidada?: {
    historicoClinicoNarrativo: string;
  };
  ocupacionalConsolidado?: {
    historicoNarrativo: string;
    cargosIdentificados: {
      cargo: string;
      periodo: string;
      empresa: string;
    }[];
  };
  pontosDeAtencao?: string;
}

@Component({
  selector: 'app-process-selector',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatListModule,
    MatDividerModule,
    MatChipsModule,
    MatIconModule,
    MatButtonModule,
    MatToolbarModule,
    MatToolbarModule,
    MatProgressSpinnerModule,
    MatProgressBarModule
  ],
  templateUrl: './process-selector.html',
  styleUrls: ['./process-selector.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProcessSelectorComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly firestore = inject(Firestore);

  readonly processId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('id')))
  );

  private readonly analysis$: Observable<ProcessAnalysis | null> = this.route.paramMap.pipe(
    map((params) => params.get('id')),
    switchMap((id) => {
      if (!id) {
        return of(null);
      }
      const docRef = doc(this.firestore, `analises_processos/${id}`);
      return docData(docRef) as Observable<ProcessAnalysis>;
    })
  );

  readonly analysis = toSignal(this.analysis$);
}