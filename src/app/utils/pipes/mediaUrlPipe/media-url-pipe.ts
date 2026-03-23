import { Pipe, PipeTransform } from '@angular/core';
import { from, Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { MediaCacheService } from 'src/services/Cache/media-cache-service';

/**
 * Pipe async — résout un chemin relatif en ObjectURL (blob://)
 * via le cache IndexedDB ou le streaming backend.
 *
 * Usage dans les templates :
 *   <img [src]="content.thumbnailUrl | mediaUrl | async">
 *   <video [src]="content.fileUrl | mediaUrl | async"></video>
 *
 * Comportement :
 *   - URL déjà complète (http/https) → retournée telle quelle
 *   - Chemin relatif → résolu via MediaCacheService
 *       1. ObjectURL en mémoire           (instantané)
 *       2. Blob en IndexedDB              (rapide, persistant)
 *       3. Stream depuis /download?path=  (réseau, puis mis en cache)
 *   - Erreur de chargement → chaîne vide (pas de 404 affiché)
 */
@Pipe({
  name: 'mediaUrl',
  standalone: true,
  pure: true,
})
export class MediaUrlPipe implements PipeTransform {

  constructor(private mediaCache: MediaCacheService) {}

  transform(relativePath: string | null | undefined): Observable<string> {
    if (!relativePath) return of('');

    // URL déjà absolue — retour immédiat sans passer par le cache
    if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
      return of(relativePath);
    }

    // Chemin relatif → résolution async via le cache
    return from(this.mediaCache.resolve(relativePath)).pipe(
      catchError(() => of(''))
    );
  }
}