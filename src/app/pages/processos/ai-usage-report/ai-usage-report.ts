import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, switchMap } from 'rxjs';
import { FirestoreService } from '../../../core/services/firestore.service';

// Material Modules
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';

export interface AiLog {
    id: string;
    processId: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    model: string;
    actionContext: string;
    timestamp: any; // Firestore Timestamp
}

@Component({
    selector: 'app-ai-usage-report',
    standalone: true,
    imports: [
        CommonModule,
        MatCardModule,
        MatTableModule,
        MatIconModule,
        MatButtonModule,
        MatChipsModule,
        MatProgressBarModule
    ],
    templateUrl: './ai-usage-report.html',
    styleUrls: ['./ai-usage-report.css'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiUsageReportComponent {
    private route = inject(ActivatedRoute);
    private firestoreService = inject(FirestoreService);
    private location = inject(Location);

    // 1. Captura ID da URL
    processId = toSignal(this.route.paramMap.pipe(map(p => p.get('id'))));

    // 2. Carrega Logs do Firestore
    logs = toSignal(
        this.route.paramMap.pipe(
            map(p => p.get('id')),
            switchMap(id => id ? this.firestoreService.getAiLogsByProcessId(id) : [])
        ),
        { initialValue: [] as AiLog[] }
    );

    // 3. Colunas da Tabela
    displayedColumns: string[] = ['data', 'acao', 'modelo', 'input', 'output', 'total'];

    // 4. Estatísticas Calculadas (Computadas automaticamente quando 'logs' muda)
    stats = computed(() => {
        const dados = this.logs();

        const totalInput = dados.reduce((acc, curr) => acc + (curr.inputTokens || 0), 0);
        const totalOutput = dados.reduce((acc, curr) => acc + (curr.outputTokens || 0), 0);
        const totalGeral = totalInput + totalOutput;
        const custoEstimado = this.estimarCusto(totalInput, totalOutput); // Opcional: Implementar lógica de preço

        // Agrupa por Contexto (Ex: Analise vs Quesitos)
        const porContexto: any = {};
        dados.forEach(d => {
            const ctx = d.actionContext || 'Outros';
            porContexto[ctx] = (porContexto[ctx] || 0) + d.totalTokens;
        });

        return {
            totalInput,
            totalOutput,
            totalGeral,
            custoEstimado,
            quantidadeRequisicoes: dados.length,
            porContexto
        };
    });

    goBack() {
        this.location.back();
    }

    // Helper simples para formatar contexto visualmente
    formatContext(ctx: string): string {
        return ctx.replace(/_/g, ' ').toUpperCase();
    }

    // Placeholder para cálculo de custo (opcional, valores fictícios do Gemini Pro)
    private estimarCusto(input: number, output: number): string {
        // Exemplo: $0.50/1M input, $1.50/1M output
        const custo = (input / 1_000_000 * 0.50) + (output / 1_000_000 * 1.50);
        return custo < 0.01 ? '< $0.01' : `$${custo.toFixed(4)}`;
    }
}