import { Routes } from '@angular/router';

// 1. Imports de Layout e Core
import { LayoutComponent } from './layout/layout';
import { authGuard } from './core/guards/auth.guard';

// 2. Imports de Pages (Feature: Auth)
import { LoginComponent } from './pages/auth/login/login';

// 3. Imports de Pages (Feature: Processos)
// Nota: Verifique se manteve o nome do arquivo como 'process-list-page' ou se renomeou para 'process-list'
import { ProcessListPageComponent } from './pages/processos/process-list/process-list-page';
import { ProcessSelectorComponent } from './pages/processos/process-selector/process-selector';
import { ProcessDetailComponent } from './pages/processos/process-detail/process-detail.component';

// 4. Imports de Pages (Feature: Perícia)
import { AvaliacaoPericialComponent } from './pages/pericia/avaliacao-pericial/avaliacao-pericial';
import { LaudoPericialComponent } from './pages/pericia/laudo-pericial/laudo-pericial';
import { DiretrizesComponent } from './pages/pericia/diretrizes/diretrizes';

// 5. Imports de Pages (Feature: Admin)
import { PromptManagerComponent } from './pages/admin/prompt-manager/prompt-manager';

export const routes: Routes = [
  // Redirecionamento inicial
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  // Rota Pública (Login)
  { path: 'login', component: LoginComponent },

  // Rotas Protegidas (Aplicação Principal)
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard], // O Guard agora está em core/guards
    children: [
      // Dashboard / Listagem
      { path: 'process-list', component: ProcessListPageComponent },
      
      // Admin
      { path: 'prompt-manager', component: PromptManagerComponent },
      { path: 'diretrizes', component: DiretrizesComponent },

      // Rotas de um Processo Específico
      // Padronizei tudo para usar ':id' para facilitar a manutenção
      { 
        path: 'process/:id', 
        component: ProcessSelectorComponent 
      },
      { 
        path: 'process/:id/documentos-analisados', 
        component: ProcessDetailComponent 
      },
      { 
        path: 'process/:id/avaliacao-pericial', 
        component: AvaliacaoPericialComponent 
      },
      { 
        path: 'process/:id/laudo-pericial', 
        component: LaudoPericialComponent 
      },
    ]
  }
];