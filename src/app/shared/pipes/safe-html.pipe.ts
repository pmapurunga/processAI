
import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({
  name: 'safeHtml',
  standalone: true, // <-- Pipe standalone
})
export class SafeHtmlPipe implements PipeTransform {

  constructor(private sanitizer: DomSanitizer) {}

  transform(value: string): SafeHtml {
    // Transforma a string em um objeto SafeHtml, confiável para o Angular
    return this.sanitizer.bypassSecurityTrustHtml(value);
  }
}
