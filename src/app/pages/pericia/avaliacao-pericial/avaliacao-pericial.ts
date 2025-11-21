
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, FormArray } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Firestore, doc, docData, setDoc } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { CommonModule, Location } from '@angular/common';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';

export interface AvaliacaoPericial {
  identificacaoProcesso?: {
    PROCESSO_NUM: string | null;
    JUIZO: string | null;
    NOME_PERICIANDO: string | null;
    DATA_EXAME: string | null;
  };
  dadosPericiando?: {
    DATA_NASCIMENTO: string | null;
    SEXO: string | null;
    ESTADO_CIVIL: string | null;
    ESCOLARIDADE: string | null;
  };
  historicoLaboral?: {
    FUNCAO_HABITUAL_ATUAL: {
      descricao: string | null;
      vinculo: string | null;
      periodo: string | null;
    };
    TEMPO_TOTAL_ATIVIDADE: string | null;
    DATA_AFASTAMENTO_DECLARADA: string | null;
    HISTORICO_OCUPACIONAL_COMPLETO: string | null;
    EXPERIENCIAS_LABORAIS_ANTERIORES: {
      descricao: string | null;
      vinculo: string | null;
      periodo: string | null;
    }[];
    PROFISSIOGRAFIA: {
      atividade_analisada: string | null;
      tarefas_executadas: string | null;
      postura_corporal: string | null;
      movimentos_repetitivos: string | null;
      carga_fisica: string | null;
      ambiente_trabalho: string | null;
      exigencias_fisicas: string | null;
      equipamentos_utilizados: string | null;
      SUMARIO_PROFISSIOGRAFICO: string | null;
    };
  };
  dadosMedicos?: {
    HISTORIA_CLINICA: string | null;
    EXAMES: string | null;
    EXAME_CLINICO: string | null;
  };
  respostasQuesitos?: any;
  dadosLaudo?: {
    DIA_LAUDO: string | null;
    MES_LAUDO: string | null;
    ANO_LAUDO: string | null;
  };
}


@Component({
  selector: 'app-avaliacao-pericial',
  templateUrl: './avaliacao-pericial.html',
  styleUrls: ['./avaliacao-pericial.css'],
  imports: [
    CommonModule, 
    ReactiveFormsModule,
    MatInputModule,
    MatFormFieldModule,
    MatButtonModule,
    MatCardModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSelectModule,
    MatDividerModule,
    MatIconModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvaliacaoPericialComponent {
  private firestore: Firestore = inject(Firestore);
  private route: ActivatedRoute = inject(ActivatedRoute);
  private fb: FormBuilder = inject(FormBuilder);
  private location: Location = inject(Location);

  processoId = this.route.snapshot.paramMap.get('id');
  avaliacao$: Observable<AvaliacaoPericial | undefined>;

  form = this.fb.group({
    identificacaoProcesso: this.fb.group({
      PROCESSO_NUM: [''],
      JUIZO: [''],
      NOME_PERICIANDO: [''],
      DATA_EXAME: [''],
    }),
    dadosPericiando: this.fb.group({
      DATA_NASCIMENTO: [''],
      SEXO: [''],
      ESTADO_CIVIL: [''],
      ESCOLARIDADE: [''],
    }),
    historicoLaboral: this.fb.group({
      FUNCAO_HABITUAL_ATUAL: this.fb.group({
        descricao: [''],
        vinculo: [''],
        periodo: [''],
      }),
      TEMPO_TOTAL_ATIVIDADE: [''],
      DATA_AFASTAMENTO_DECLARADA: [''],
      HISTORICO_OCUPACIONAL_COMPLETO: [''],
      EXPERIENCIAS_LABORAIS_ANTERIORES: this.fb.array([
        this.fb.group({
          descricao: [''],
          vinculo: [''],
          periodo: [''],
        }),
      ]),
      PROFISSIOGRAFIA: this.fb.group({
        atividade_analisada: [''],
        tarefas_executadas: [''],
        postura_corporal: [''],
        movimentos_repetitivos: [''],
        carga_fisica: [''],
        ambiente_trabalho: [''],
        exigencias_fisicas: [''],
        equipamentos_utilizados: [''],
        SUMARIO_PROFISSIOGRAFICO: [''],
      }),
    }),
    dadosMedicos: this.fb.group({
      HISTORIA_CLINICA: [''],
      EXAMES: [''],
      EXAME_CLINICO: [''],
    }),
    dadosLaudo: this.fb.group({
      DIA_LAUDO: [''],
      MES_LAUDO: [''],
      ANO_LAUDO: [''],
    }),
  });

  constructor() {
    if (this.processoId) {
      const docRef = doc(this.firestore, `analises_processos/${this.processoId}/pericia/avaliacao_pericial`);
      // Tentar carregar dados existentes, mas não bloquear se não existirem
      this.avaliacao$ = docData(docRef) as Observable<AvaliacaoPericial | undefined>;
      this.avaliacao$.subscribe(data => {
        if (data) {
          this.form.patchValue(data as any);
        }
      });
    } else {
      this.avaliacao$ = new Observable();
    }

    // Configurar auto-save quando os campos forem alterados
    this.form.valueChanges.subscribe(() => {
      this.save();
    });
  }

  save() {
    if (this.processoId) {
      const docRef = doc(this.firestore, `analises_processos/${this.processoId}/pericia/avaliacao_pericial`);
      // Criar ou atualizar o documento
      setDoc(docRef, this.form.value, { merge: true }).catch(error => {
        console.error('Erro ao salvar dados:', error);
      });
    }
  }

  get experienciasArray() {
    return this.form.get('historicoLaboral.EXPERIENCIAS_LABORAIS_ANTERIORES') as FormArray;
  }

  get experienciasControls() {
    return (this.form.get('historicoLaboral.EXPERIENCIAS_LABORAIS_ANTERIORES') as FormArray).controls;
  }

  adicionarExperiencia() {
    this.experienciasArray.push(this.fb.group({
      descricao: [''],
      vinculo: [''],
      periodo: ['']
    }));
  }

  removeExperiencia(index: number) {
    this.experienciasArray.removeAt(index);
  }

  podeRemoverExperiencia(): boolean {
    return this.experienciasArray.length > 1;
  }

  voltar(): void {
    this.location.back();
  }
}
