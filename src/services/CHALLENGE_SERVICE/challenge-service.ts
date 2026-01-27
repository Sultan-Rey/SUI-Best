import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { ApiJSON } from '../API/LOCAL/api-json';
import { Challenge } from '../../models/Challenge';

@Injectable({
  providedIn: 'root'
})
export class ChallengeService {
  private readonly challengeResource = 'challenges';
  private readonly uploadResource = 'api/upload';

  constructor(private api: ApiJSON) {}

  createChallenge(challengeData: Omit<Challenge, 'id' | 'created_at' | 'is_active'>): Observable<Challenge> {
    const challenge = {
      ...challengeData,
      created_at: new Date(Date.now()),
      is_active: true
    };
    return this.api.create<Challenge>(this.challengeResource, challenge);
  }

  createChallengeWithCoverImage(
    coverImage: File,
    challengeData: Omit<Challenge, 'id' | 'created_at' | 'is_active' | 'cover_image_url'>,
    progressCallback?: (progress: number) => void
  ): Observable<Challenge> {
    return new Observable(observer => {
      this.api.upload<{ file: { path: string } }>(
        this.uploadResource,
        coverImage,
        'file',
        !!progressCallback
      ).subscribe({
        next: (event: any) => {
          if (event.type === 1 && event.loaded && event.total && progressCallback) {
            const progress = Math.round((100 * event.loaded) / event.total);
            progressCallback(progress);
          } else if (event.type === 4) {
            let coverImageUrl: string;
            
            if (typeof event.body === 'string') {
              coverImageUrl = event.body;
            } else if (event.body?.file?.path) {
              coverImageUrl = event.body.file.path;
            } else if (event.body?.path) {
              coverImageUrl = event.body.path;
            } else {
              observer.error(new Error('Format de réponse inattendu'));
              return;
            }

            const challengeWithImage = {
              ...challengeData,
              cover_image_url: coverImageUrl
            };

            this.api.create<Challenge>(this.challengeResource, challengeWithImage)
              .subscribe({
                next: (challenge) => observer.next(challenge),
                error: (err) => observer.error(err)
              });
          }
        },
        error: (err) => observer.error(err)
      });
    });
  }

  getActiveChallenges(): Observable<Challenge[]> {
    return this.api.getAll<Challenge>(this.challengeResource, {
      is_active: 'true',
      _sort: 'created_at',
      _order: 'desc'
    });
  }

  updateChallenge(id: string, updates: Partial<Challenge>): Observable<Challenge> {
    return this.api.update<Challenge>(this.challengeResource, id, updates);
  }

  getChallengeById(id: string): Observable<Challenge> {
    return this.api.getById<Challenge>(this.challengeResource, id);
  }

  getChallengesByCreator(creatorId: string): Observable<Challenge[]> {
    return this.api.getAll<Challenge>(this.challengeResource, {
      creator_id: creatorId,
      _sort: 'created_at',
      _order: 'desc'
    });
  }

  getMostPopularActiveChallenge(): Observable<Challenge | null> {
    return this.getActiveChallenges().pipe(
      map(challenges => {
        if (!challenges || challenges.length === 0) {
          return null;
        }
        
        const sortedChallenges = [...challenges].sort((a, b) => {
          const aCount = a.participants_count || 0;
          const bCount = b.participants_count || 0;
          return bCount - aCount;
        });

        return sortedChallenges[0];
      }),
      catchError(error => {
        console.error('Erreur lors de la récupération du challenge le plus populaire:', error);
        return of(null);
      })
    );
  }
}