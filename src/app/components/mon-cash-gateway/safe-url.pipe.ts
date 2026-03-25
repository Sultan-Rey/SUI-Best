import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Pipe({
  name: 'safeUrl'
})
export class SafePipe implements PipeTransform {

  constructor(protected sanitizer: DomSanitizer) {}

  public transform(value: any, type: string = 'url'): SafeResourceUrl {
    // On demande au sanitizer de valider l'URL pour une ressource (iframe/src)
    return this.sanitizer.bypassSecurityTrustResourceUrl(value);
  }

}