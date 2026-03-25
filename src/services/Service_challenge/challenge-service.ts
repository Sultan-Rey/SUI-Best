import { Injectable } from '@angular/core';
import { Observable, of, throwError, forkJoin } from 'rxjs';
import { catchError, map, tap, switchMap } from 'rxjs/operators';
import { ApiJSON, FilterResult } from '../API/LOCAL/api-json'; // ✅ Migration vers notre ApiJSON unifié
import { Challenge } from '../../models/Challenge';

@Injectable({
  providedIn: 'root'
})
export class ChallengeService {
  private readonly challengeResource = 'challenges';
  private readonly uploadResource = 'api/upload';

  constructor(private api: ApiJSON) {} // ✅ Migration vers notre ApiJSON unifié

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
        coverImage,
        'challenges',
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
    return this.api.get<Challenge[]>(this.challengeResource, {
      is_active: 'true'});
  }

  updateChallenge(id: string, updates: Partial<Challenge>): Observable<Challenge> {
    return this.api.update<Challenge>(this.challengeResource, id, updates);
  }

  getChallengeById(id: string): Observable<Challenge | null> {
    return this.api.getById<Challenge | null>(this.challengeResource, id);
  }

  getChallengesByCreator(creatorIds: string[]): Observable<Challenge[]> {
    if (creatorIds.length === 0) return of([]);
    
    // Solution 1: Requêtes multiples en parallèle
    const requests = creatorIds.map(id => 
      this.api.filter<Challenge>(this.challengeResource, { filters: {creator_id: id} })
    );
    
    return forkJoin(requests).pipe(
      map(results => {
        // Aplatir tous les tableaux manuellement (compatibilité ES2018)
        const flattened: Challenge[] = [];
        results.forEach((result: FilterResult<Challenge>) => {
          flattened.push(...result.data);
        });
        return flattened;
      }),
      map(challenges => {
        // Supprimer les doublons basés sur l'ID
        const unique = challenges.filter((challenge: Challenge, index: number, self: Challenge[]) =>
          index === self.findIndex((c: Challenge) => c.id === challenge.id)
        );
        return unique;
      })
    );
  }

  // Méthode de commodité pour un seul creator_id (compatibilité descendante)
  getChallengesBySingleCreator(creatorId: string): Observable<Challenge[]> {
    return this.api.get<Challenge[]>(this.challengeResource, {
      creator_id: creatorId
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



  /**
   * Calcule le nombre total de vues pour un challenge donné
   * @param challengeId ID du challenge
   * @returns Observable<number> Nombre total de vues
   */
  getTotalViewsForChallenge(challengeId: string): Observable<number> {
    return this.api.get<any>('contents', { challengeId }).pipe(
      map(contents => {
        if (!contents || contents.length === 0) {
          return 0;
        }
        
        // Sommer tous les viewCount des contenus associés au challenge
        return contents.reduce((total: number, content: any) => {
          return total + (content.viewCount || 0);
        }, 0);
      }),
      catchError(error => {
        console.error('Erreur lors du calcul des vues pour le challenge:', error);
        return of(0);
      })
    );
  }

}