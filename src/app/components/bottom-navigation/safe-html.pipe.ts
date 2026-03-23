import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

/**
 * SafeHtml pipe — requis pour [innerHTML]="... | safeHtml"
 * Ajouter SafeHtmlPipe dans les declarations du module.
 *
 * Usage dans template :
 *   <svg [innerHTML]="item.iconPath | safeHtml"></svg>
 */
@Pipe({ name: 'safeHtml' })
export class SafeHtmlPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}
  transform(value: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(value);
  }
}
