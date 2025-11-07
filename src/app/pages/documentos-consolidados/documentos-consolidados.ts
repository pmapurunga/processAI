import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { doc, docData, Firestore } from '@angular/fire/firestore';
import { Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';

// Angular Material Modules
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';

import { DocumentoConsolidado } from '../../models/documento-consolidado.model';

@Component({
  selector: 'app-documentos-consolidados',
  standalone: true,
  imports: [
    CommonModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatExpansionModule,
    MatListModule,
    MatDividerModule,
    MatProgressBarModule,
    MatChipsModule,
    MatTooltipModule,
  ],
  templateUrl: './documentos-consolidados.html',
  styleUrls: ['./documentos-consolidados.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentosConsolidadosComponent {
  private firestore = inject(Firestore);
  private route = inject(ActivatedRoute);
  private location = inject(Location);

  public documento$: Observable<DocumentoConsolidado | undefined>;

  constructor() {
    this.documento$ = this.route.paramMap.pipe(
      switchMap(params => {
        const processId = params.get('processId');
        if (!processId) {
          console.error('ID do processo não encontrado na URL!');
          return of(undefined);
        }

        const docPath = `processos/${processId}/documentos_consolidados/analise_principal`;
        const docRef = doc(this.firestore, docPath);

        return docData(docRef) as Observable<DocumentoConsolidado | undefined>;
      })
    );
  }

  goBack(): void {
    this.location.back();
  }
}
