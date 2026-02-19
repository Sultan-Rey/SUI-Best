import { Pipe, PipeTransform } from '@angular/core';
import { environment } from '../../../../environments/environment';

@Pipe({
  name: 'mediaUrl',
  standalone: true,
})
export class MediaUrlPipe implements PipeTransform {
  transform(relativePath: string | null | undefined): string {
    if (!relativePath) return '';
    
    // Si c'est déjà une URL complète, on la retourne telle quelle
    if (relativePath.startsWith('http') || relativePath.startsWith('https')) {
      return relativePath;
    }
    
    // Construire l'URL de base
    return `${environment.apiUrl}/${relativePath.replace(/^\/+/, '')}`;
  }
}
