import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FirestoreService } from '../../firestore.service';
import { Router } from '@angular/router';
import { Subject, switchMap, tap } from 'rxjs';
import { ProcessService } from '../../services/process.service';
import { MatListModule } from '@angular/material/list';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ConfirmDialogComponent } from './confirm-dialog.component';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-process-list-page',
  imports: [
    CommonModule,
    MatListModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatPaginatorModule,
    MatDialogModule,
    MatIconModule
  ],
  templateUrl: './process-list-page.html',
  styleUrls: ['./process-list-page.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProcessListPageComponent {
  private firestoreService = inject(FirestoreService);
  private processService = inject(ProcessService);
  private router = inject(Router);
  private dialog = inject(MatDialog);

  // Constants
  private readonly ITEMS_PER_PAGE = 10;
  private refreshProcesses$ = new Subject<void>();

  // Signals for state management
  public searchTerm = signal<string>('');
  public currentPage = signal<number>(0);
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

  public paginatorConfig = computed(() => ({
    length: this.filteredProcesses().length,
    pageSize: this.ITEMS_PER_PAGE,
    pageIndex: this.currentPage(),
  }));

  public paginatedProcesses = computed(() => {
    const pageIndex = this.currentPage();
    const start = pageIndex * this.ITEMS_PER_PAGE;
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
    this.currentPage.set(0); // Reset page on new search
  }

  handlePageEvent(event: PageEvent): void {
    this.currentPage.set(event.pageIndex);
  }

  refreshProcesses(): void {
    this.isLoading.set(true);
    this.refreshProcesses$.next();
  }

  deleteProcess(processId: string): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent);

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
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
    });
  }
}
