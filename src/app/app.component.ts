import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule],
  template: '<router-outlet></router-outlet>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  // O AuthService ainda está sendo injetado e inicializado,
  // então o monitoramento do estado de autenticação continua funcionando.
  public authService = inject(AuthService);

  constructor() {
    this.authService.user$.subscribe(user => {
      // Este log ainda é útil para vermos o estado do usuário.
      console.log('User state changed in AppComponent:', user);
    });
  }
}
