// media.service.ts
import { Inject, Injectable } from '@angular/core';
import { ApiJSON } from '../API/LOCAL/api-json';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class MediaService {
  constructor(@Inject('ApiJSON') private apiJSON: ApiJSON) {}

  getImageURL(path: string): Observable<string> {
    if (!path) {
      return new Observable(subscriber => {
        subscriber.error(new Error('Image path is required'));
      });
    }

    return this.apiJSON.getFile(path).pipe(
      map((blob: Blob) => {
        return URL.createObjectURL(blob);
      })
    );
  }

  revokeImageURL(url: string): void {
    if (url && url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  }
}