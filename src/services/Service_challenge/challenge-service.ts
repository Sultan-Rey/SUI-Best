import { Injectable } from '@angular/core';
import { Observable, of, throwError, forkJoin, BehaviorSubject } from 'rxjs';
import { catchError, map, tap, switchMap, shareReplay, filter } from 'rxjs/operators';
import { ApiJSON, FilterResult } from '../API/api-json';
import { Challenge } from '../../models/Challenge';
import { ParticipantRequest } from 'src/models/ParticipantRequest';

@Injectable({
  providedIn: 'root'
})
export class ChallengeService {
  private readonly challengeResource = 'challenges';
  private readonly uploadResource = 'api/upload';

  // ─── Stores ───────────────────────────────────────────────────
  private activeChallengesSubject = new BehaviorSubject<Challenge[]>([]);
  private popularChallengeSubject = new BehaviorSubject<Challenge | null>(null);
  private pendingRequestsSubject = new BehaviorSubject<ParticipantRequest[]>([]);
  private pendingRequestsCountSubject = new BehaviorSubject<number>(0);
  private createdChallengeSubject = new BehaviorSubject<Challenge | null>(null);

  // ─── Observables publics ──────────────────────────────────────
  activeChallenges$ = this.activeChallengesSubject.asObservable();
  popularChallenge$ = this.popularChallengeSubject.asObservable();
  pendingRequests$ = this.pendingRequestsSubject.asObservable();
  pendingRequestsCount$ = this.pendingRequestsCountSubject.asObservable();
  createdChallenge$ = this.createdChallengeSubject.asObservable();

  constructor(private api: ApiJSON) {}

  // ==============================================================
  //  CRÉATION DE CHALLENGE
  // ==============================================================

  createChallenge(challengeData: Omit<Challenge, 'id' | 'created_at' | 'is_active'>): Observable<Challenge> {
    const challenge = {
      ...challengeData,
      created_at: new Date(Date.now()),
      is_active: true
    };
    return this.api.create<Challenge>(this.challengeResource, challenge).pipe(
      tap(created => {
        this.createdChallengeSubject.next(created);
        this.addChallengeToActiveList(created);
      }),
      shareReplay(1),
      catchError(err => {
        console.error('[ChallengeService] createChallenge error:', err);
        return throwError(() => err);
      })
    );
  }

  createChallengeWithCoverImage(
    coverImage: File,
    challengeData: Omit<Challenge, 'id' | 'created_at' | 'is_active' | 'cover_image_url'>,
    progressCallback?: (progress: number) => void
  ): Observable<Challenge> {
    return new Observable<Challenge>(observer => {
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
                next: (challenge) => {
                  this.createdChallengeSubject.next(challenge);
                  this.addChallengeToActiveList(challenge);
                  observer.next(challenge);
                  observer.complete();
                },
                error: (err) => observer.error(err)
              });
          }
        },
        error: (err) => observer.error(err)
      });
    }).pipe(
      shareReplay(1),
      catchError(err => {
        console.error('[ChallengeService] createChallengeWithCoverImage error:', err);
        return throwError(() => err);
      })
    );
  }

  // ==============================================================
  //  CHALLENGES ACTIFS
  // ==============================================================

  getActiveChallenges(creatorId: string, adminId: string): Observable<FilterResult<Challenge>> {
    const nowSQL = new Date().toISOString().slice(0, 19).replace('T', ' ');

    const allowedCreators = [
      creatorId ? (creatorId.startsWith('INS_') ? creatorId : `INS_${creatorId}`) : null,
      adminId?.toString().trim() || null
    ].filter(id => !!id && id !== '-' && id !== 'null' && id !== 'undefined') as string[];

    if (allowedCreators.length === 0) {
      const emptyResult: FilterResult<Challenge> = { data: [], pagination: {
        total: 0,
        limit: 0,
        offset: 0,
        page: 0,
        per_page: 0,
        total_pages: 0,
        has_next: false,
        has_prev: false
      } };
      this.activeChallengesSubject.next([]);
      return of(emptyResult);
    }

    return this.api.filter<Challenge>(this.challengeResource, {
      filters: {
        is_active: 1,
        end_date: { operator: '>=', value: nowSQL },
        creator_id: { operator: 'IN', value: allowedCreators }
      },
      options: { limit: 100, sort: { created_at: 'desc' } }
    }, { cache: false }).pipe(
      tap(result => {
        this.activeChallengesSubject.next(result.data || []);
      }),
      catchError(err => {
        console.error('[ChallengeService] getActiveChallenges error:', err);
        const emptyResult: FilterResult<Challenge> = { data: [], pagination: {
          total: 0,
          limit: 0,
          offset: 0,
          page: 0,
          per_page: 0,
          total_pages: 0,
          has_next: false,
          has_prev: false
        } };
        this.activeChallengesSubject.next([]);
        return of(emptyResult);
      })
    );
  }

  /**
   * Rafraîchit les challenges actifs sans retourner d'Observable
   * Utile après une modification
   */
  refreshActiveChallenges(creatorId: string, adminId: string): void {
    this.getActiveChallenges(creatorId, adminId).subscribe({
      error: (err) => console.error('[ChallengeService] refreshActiveChallenges error:', err)
    });
  }

  // ==============================================================
  //  CHALLENGE POPULAIRE
  // ==============================================================

  getMostPopularActiveChallenge(creatorId: string, adminId: string): Observable<Challenge | null> {
    return this.getActiveChallenges(creatorId, adminId).pipe(
      map(result => {
        const challenges = result?.data;
        if (!challenges || challenges.length === 0) {
          this.popularChallengeSubject.next(null);
          return null;
        }
        
        const sortedChallenges = [...challenges].sort((a, b) => {
          const aCount = a.participants_count || 0;
          const bCount = b.participants_count || 0;
          return bCount - aCount;
        });

        const popular = sortedChallenges[0];
        this.popularChallengeSubject.next(popular);
        return popular;
      }),
      catchError(error => {
        console.error('[ChallengeService] getMostPopularActiveChallenge error:', error);
        this.popularChallengeSubject.next(null);
        return of(null);
      })
    );
  }

  /**
   * Rafraîchit le challenge populaire
   */
  refreshPopularChallenge(creatorId: string, adminId: string): void {
    this.getMostPopularActiveChallenge(creatorId, adminId).subscribe({
      error: (err) => console.error('[ChallengeService] refreshPopularChallenge error:', err)
    });
  }

  // ==============================================================
  //  REQUÊTES DE PARTICIPATION
  // ==============================================================

  createParticipationRequest(request: ParticipantRequest): Observable<ParticipantRequest> {
    return this.api.create<ParticipantRequest>('participant_requests', request).pipe(
      tap(created => {
        const currentCount = this.pendingRequestsCountSubject.value;
        this.pendingRequestsCountSubject.next(currentCount + 1);
        const currentList = this.pendingRequestsSubject.value;
        this.pendingRequestsSubject.next([...currentList, created]);
      }),
      shareReplay(1),
      catchError(err => {
        console.error('[ChallengeService] createParticipationRequest error:', err);
        return throwError(() => err);
      })
    );
  }

  /**
   * Récupère toutes les demandes en attente pour un challenge spécifique
   */
  getPendingRequestsByChallengeId(challengeId: string): Observable<ParticipantRequest[]> {
    return this.api.filter<ParticipantRequest>('participant_requests', {
      filters: {
        challenge_id: challengeId,
        status: 'pending'
      },
      options: { limit: 100, sort: { created_at: 'asc' } }
    }).pipe(
      map((result: FilterResult<ParticipantRequest>) => result.data || []),
      tap(requests => {
        this.pendingRequestsSubject.next(requests);
      }),
      catchError(err => {
        console.error('[ChallengeService] getPendingRequestsByChallengeId error:', err);
        this.pendingRequestsSubject.next([]);
        return of([]);
      })
    );
  }

  /**
   * Rafraîchit les requêtes en attente pour un challenge
   */
  refreshPendingRequests(challengeId: string): void {
    this.getPendingRequestsByChallengeId(challengeId).subscribe({
      error: (err) => console.error('[ChallengeService] refreshPendingRequests error:', err)
    });
  }

  /**
   * Récupère le nombre total de requêtes en attente
   */
 getPendingRequestsCountFast(creatorId: string): Observable<number> {
  
  console.debug('[ChallengeService] getPendingRequestsCountFast START', {
    creatorId
  });

  return this.getChallengesBySingleCreator(creatorId).pipe(
    tap((challenges: Challenge[]) => {
      console.debug('[ChallengeService] challenges fetched', {
        count: challenges?.length ?? 0,
        challenges
      });
    }),

    switchMap((challenges: Challenge[]) => {
      if (!challenges || challenges.length === 0) {
        console.debug('[ChallengeService] no challenges found -> returning 0');
        this.pendingRequestsCountSubject.next(0);
        return of(0);
      }

      const challengeIds = challenges.map(c => c.id);

      console.debug('[ChallengeService] extracted challengeIds', {
        challengeIds,
        count: challengeIds.length
      });

      return this.api
        .filter<ParticipantRequest>('participant_requests', {
          filters: {
            challenge_id: { operator: 'IN', value: challengeIds } ,
            status: 'pending'
          },
          options: {
            limit: 1
          }
        })
        .pipe(
          tap((result: FilterResult<ParticipantRequest>) => {
            console.debug('[ChallengeService] API filter response (raw)', result);
          }),

          map((result: FilterResult<ParticipantRequest>) => {
            const total = result?.data.length || 0;
            console.debug('[ChallengeService] computed pending requests count', {
              total
            });
            return total;
          }),

          tap(count => {
            console.debug('[ChallengeService] updating subject with count', {
              count
            });
            this.pendingRequestsCountSubject.next(count);
          })
        );
    }),

    catchError(err => {
      console.error('[ChallengeService] getPendingRequestsCountFast ERROR', {
        error: err,
        creatorId
      });

      this.pendingRequestsCountSubject.next(0);
      return of(0);
    }),

    tap({
      complete: () =>
        console.debug('[ChallengeService] getPendingRequestsCountFast COMPLETE')
    })
  );
}

  /**
   * Rafraîchit le compteur de requêtes en attente
   */
  refreshPendingRequestsCount(creatorId: string): void {
    this.getPendingRequestsCountFast(creatorId).subscribe({
      error: (err) => console.error('[ChallengeService] refreshPendingRequestsCount error:', err)
    });
  }

  /**
   * Accepte une demande de participation
   */
  acceptParticipantRequest(requestId: string): Observable<ParticipantRequest> {
    return this.api.update<ParticipantRequest>('participant_requests', requestId, { status: 'approved' }).pipe(
      tap(updated => {
        const currentList = this.pendingRequestsSubject.value;
        this.pendingRequestsSubject.next(currentList.filter(r => r.id !== requestId));
        const currentCount = this.pendingRequestsCountSubject.value;
        this.pendingRequestsCountSubject.next(Math.max(0, currentCount - 1));
      }),
      shareReplay(1),
      catchError(err => {
        console.error('[ChallengeService] acceptParticipantRequest error:', err);
        return throwError(() => err);
      })
    );
  }

  /**
   * Refuse une demande de participation
   */
  rejectParticipantRequest(requestId: string): Observable<ParticipantRequest> {
    return this.api.update<ParticipantRequest>('participant_requests', requestId, { status: 'rejected' }).pipe(
      tap(updated => {
        const currentList = this.pendingRequestsSubject.value;
        this.pendingRequestsSubject.next(currentList.filter(r => r.id !== requestId));
        const currentCount = this.pendingRequestsCountSubject.value;
        this.pendingRequestsCountSubject.next(Math.max(0, currentCount - 1));
      }),
      shareReplay(1),
      catchError(err => {
        console.error('[ChallengeService] rejectParticipantRequest error:', err);
        return throwError(() => err);
      })
    );
  }

  // ==============================================================
  //  CRUD STANDARD
  // ==============================================================

  updateChallenge(id: string, updates: Partial<Challenge>): Observable<Challenge> {
    return this.api.update<Challenge>(this.challengeResource, id, updates).pipe(
      tap(updated => {
        this.updateLocalChallenges(updated);
        if (this.popularChallengeSubject.value?.id === updated.id) {
          this.popularChallengeSubject.next(updated);
        }
      }),
      shareReplay(1),
      catchError(err => {
        console.error('[ChallengeService] updateChallenge error:', err);
        return throwError(() => err);
      })
    );
  }

  getChallengeById(id: string): Observable<Challenge | null> {
    return this.api.getById<Challenge | null>(this.challengeResource, id).pipe(
      catchError(err => {
        console.error('[ChallengeService] getChallengeById error:', err);
        return of(null);
      })
    );
  }

  getChallengesByCreator(creatorIds: string[]): Observable<Challenge[]> {
    if (creatorIds.length === 0) return of([]);
    
    const requests = creatorIds.map(id => 
      this.api.filter<Challenge>(this.challengeResource, { filters: { creator_id: id } })
    );
    
    return forkJoin(requests).pipe(
      map(results => {
        const flattened: Challenge[] = [];
        results.forEach((result: FilterResult<Challenge>) => {
          flattened.push(...result.data);
        });
        return flattened;
      }),
      map(challenges => {
        const unique = challenges.filter((challenge: Challenge, index: number, self: Challenge[]) =>
          index === self.findIndex((c: Challenge) => c.id === challenge.id)
        );
        return unique;
      }),
      catchError(err => {
        console.error('[ChallengeService] getChallengesByCreator error:', err);
        return of([]);
      })
    );
  }

  getChallengesBySingleCreator(creatorId: string): Observable<Challenge[]> {
    return this.api.filter<Challenge>(this.challengeResource, {
      filters: {
        is_active: 1,
        creator_id: creatorId
      },
      options: { limit: 100, sort: { created_at: 'desc' } }
    }, { cache: false }).pipe(
      map((result: FilterResult<Challenge>) => result.data || []),
      catchError(err => {
        console.error('[ChallengeService] getChallengesBySingleCreator error:', err);
        return of([]);
      })
    );
  }

  // ==============================================================
  //  STATISTIQUES
  // ==============================================================

  /**
   * Calcule le nombre total de vues pour un challenge donné
   */
  getTotalViewsForChallenge(challengeId: string): Observable<number> {
    return this.api.get<any>('contents', { challengeId }).pipe(
      map(contents => {
        if (!contents || contents.length === 0) {
          return 0;
        }
        return contents.reduce((total: number, content: any) => {
          return total + (content.viewCount || 0);
        }, 0);
      }),
      catchError(error => {
        console.error('[ChallengeService] getTotalViewsForChallenge error:', error);
        return of(0);
      })
    );
  }

  // ==============================================================
  //  MÉTHODES PRIVÉES DE MISE À JOUR LOCALE
  // ==============================================================

  /**
   * Ajoute un challenge à la liste des challenges actifs
   */
  private addChallengeToActiveList(challenge: Challenge): void {
    const currentList = this.activeChallengesSubject.value;
    if (!currentList.some(c => c.id === challenge.id)) {
      this.activeChallengesSubject.next([challenge, ...currentList]);
    }
  }

  /**
   * Met à jour un challenge dans toutes les listes locales
   */
  private updateLocalChallenges(updated: Challenge): void {
    const updateList = (list: Challenge[]) =>
      list.map(c => c.id === updated.id ? updated : c);

    this.activeChallengesSubject.next(updateList(this.activeChallengesSubject.value));
    
    if (this.createdChallengeSubject.value?.id === updated.id) {
      this.createdChallengeSubject.next(updated);
    }
  }

  // ==============================================================
  //  MÉTHODES DE RÉINITIALISATION
  // ==============================================================

  /**
   * Réinitialise tous les stores (utile lors de la déconnexion)
   */
  resetStores(): void {
    this.activeChallengesSubject.next([]);
    this.popularChallengeSubject.next(null);
    this.pendingRequestsSubject.next([]);
    this.pendingRequestsCountSubject.next(0);
    this.createdChallengeSubject.next(null);
  }

  /**
   * Réinitialise les stores liés aux requêtes de participation
   */
  resetRequestsStores(): void {
    this.pendingRequestsSubject.next([]);
    this.pendingRequestsCountSubject.next(0);
  }
}