import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

@Component({
  selector: 'app-process-selector',
  imports: [CommonModule, RouterLink],
  templateUrl: './process-selector.html',
  styleUrls: ['./process-selector.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProcessSelectorComponent {
  private readonly route = inject(ActivatedRoute);
  readonly processId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('id')))
  );
}
