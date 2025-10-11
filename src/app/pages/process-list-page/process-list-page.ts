import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FirestoreService } from '../../firestore.service';
import { Router } from '@angular/router';
import { Subject, switchMap, tap } from 'rxjs';
import { ProcessService } from '../../services/process.service';

@Component({
  selector: 'app-process-list-page',
  imports: [CommonModule],
  templateUrl: './process-list-page.html',
  styleUrls: ['./process-list-page.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProcessListPageComponent {
  private firestoreService = inject(FirestoreService);
  private processService = inject(ProcessService);
  private router = inject(Router);

  // Constants
  private readonly ITEMS_PER_PAGE = 10;
  private refreshProcesses$ = new Subject<void>();

  // Signals for state management
  public searchTerm = signal<string>('');
  public currentPage = signal<number>(1);
  public processes = signal<any[]>([]);
  public isLoading = signal<boolean>(true);


  constructor() {
    this.refreshProcesses$.pipe(
      switchMap(() => this.firestoreService.getProcessos()),
      tap(procs => {
        this.processes.set(procs);
        this.isLoading.set(false);
      })
    ).subscribe();

    this.refreshProcesses();
  }

  // Computed signal for filtered processes
  public filteredProcesses = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const procs = this.processes();
    if (!term) return procs;
    return procs.filter((p: any) => p.id.toLowerCase().includes(term));
  });

  // Computed signals for pagination
  public totalPages = computed(() =>
    Math.ceil(this.filteredProcesses().length / this.ITEMS_PER_PAGE)
  );

  public paginatedProcesses = computed(() => {
    const page = this.currentPage();
    const start = (page - 1) * this.ITEMS_PER_PAGE;
    const end = start + this.ITEMS_PER_PAGE;
    return this.filteredProcesses().slice(start, end);
  });


  // Methods
  viewDetails(processId: string) {
    this.router.navigate(['/process', processId]);
  }

  onSearchTermChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchTerm.set(value);
    this.currentPage.set(1); // Reset page on new search
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  nextPage(): void {
    this.goToPage(this.currentPage() + 1);
  }

  previousPage(): void {
    this.goToPage(this.currentPage() - 1);
  }

  refreshProcesses(): void {
    this.isLoading.set(true);
    this.refreshProcesses$.next();
  }

  deleteProcess(processId: string): void {
    if (confirm(`Tem certeza que deseja apagar o processo ${processId}?`)) {
      this.isLoading.set(true);
      this.processService.deleteProcess(processId).subscribe({
        next: () => {
          this.processes.update((procs: any[]) => procs.filter((p: any) => p.id !== processId));
          this.isLoading.set(false);
        },
        error: (err: any) => {
          console.error('Erro ao apagar o processo:', err);
          this.isLoading.set(false);
          // Adicionar uma notificação de erro para o usuário aqui
        }
      });
    }
  }
}
