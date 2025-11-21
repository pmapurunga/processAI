import { Routes } from '@angular/router';
import { LayoutComponent } from './layout/layout';
import { ProcessListPageComponent } from './pages/process-list-page/process-list-page';
import { PromptManagerComponent } from './pages/prompt-manager/prompt-manager';
import { ProcessDetailComponent } from './process-detail/process-detail.component';
import { LoginComponent } from './login/login';
import { authGuard } from './auth.guard';
import { ProcessSelectorComponent } from './pages/process-selector/process-selector';
import { AvaliacaoPericialComponent } from './pages/avaliacao-pericial/avaliacao-pericial';
import { LaudoPericialComponent } from './pages/laudo-pericial/laudo-pericial';
import { DiretrizesComponent } from './pages/diretrizes/diretrizes';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: 'process-list', component: ProcessListPageComponent },
      { path: 'prompt-manager', component: PromptManagerComponent },
      { path: 'diretrizes', component: DiretrizesComponent},
      { path: 'process/:id', component: ProcessSelectorComponent },
      { path: 'process/:id/documentos-analisados', component: ProcessDetailComponent },
      { path: 'process/:processoId/avaliacao-pericial', component: AvaliacaoPericialComponent },
      { path: 'process/:numero_processo/laudo-pericial', component: LaudoPericialComponent },
    ]
  }
];
