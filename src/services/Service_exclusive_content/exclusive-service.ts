import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, forkJoin, map, of, switchMap, throwError } from 'rxjs';
import { ApiJSON } from '../API/LOCAL/api-json';
import { ExclusiveContent, Series, Author } from '../../models/Content';
import { ProfileService } from '../Service_profile/profile-service';

@Injectable({
  providedIn: 'root',
})
export class ExclusiveService {
  private readonly SERIES_RESOURCE = 'series';
  private readonly EXCLUSIVE_CONTENT_RESOURCE = 'exclusive-contents';

  // Stores
  private featuredSubject = new BehaviorSubject<ExclusiveContent[]>([]);
  private allContentsSubject = new BehaviorSubject<ExclusiveContent[]>([]);
  private seriesSubject = new BehaviorSubject<Series[]>([]);

  featured$ = this.featuredSubject.asObservable();
  allContents$ = this.allContentsSubject.asObservable();
  series$ = this.seriesSubject.asObservable();

  constructor(
    private api: ApiJSON,
    private profileService: ProfileService
  ) {}

  // ─── SÉRIES ────────────────────────────────────────────────────────────────

  /**
   * Récupère toutes les séries
   */
  getSeries(): Observable<Series[]> {
    return this.api.get<Series[]>(this.SERIES_RESOURCE).pipe(
      map(series => {
        this.seriesSubject.next(series);
        return series;
      }),
      catchError(err => {
        console.error('[ExclusiveService] getSeries:', err);
        return of([]);
      })
    );
  }

  /**
   * Récupère une série par son ID avec ses épisodes
   */
  getSeriesById(seriesId: string): Observable<Series | null> {
    return this.api.getById<Series>(this.SERIES_RESOURCE, seriesId).pipe(
      switchMap(series => {
        if (!series) return of(null);
        
        // Récupérer les épisodes de la série
        return this.getEpisodesBySeriesId(seriesId).pipe(
          map(episodes => ({
            ...series,
            episodeIds: episodes.map(ep => ep.id)
          }))
        );
      }),
      catchError(err => {
        console.error('[ExclusiveService] getSeriesById:', err);
        return of(null);
      })
    );
  }

  /**
   * Récupère les épisodes d'une série
   */
  getEpisodesBySeriesId(seriesId: string): Observable<ExclusiveContent[]> {
    return this.api.filter<ExclusiveContent>(this.EXCLUSIVE_CONTENT_RESOURCE, {
      filters: { seriesId },
      options: { sort: { episodeNumber: 'asc' } }
    }).pipe(
      map(result => result.data),
      catchError(err => {
        console.error('[ExclusiveService] getEpisodesBySeriesId:', err);
        return of([]);
      })
    );
  }

  /**
   * Crée une nouvelle série
   */
  createSeries(seriesData: Omit<Series, 'id' | 'created_at' | 'updated_at' | 'episodeIds' | 'viewCount' | 'likeCount'>): Observable<Series> {
    const series: Omit<Series, 'id'> = {
      ...seriesData,
      created_at: new Date().toISOString(),
      episodeIds: [],
      viewCount: 0,
      likeCount: 0
    };

    return this.api.create<Series>(this.SERIES_RESOURCE, series).pipe(
      catchError(err => {
        console.error('[ExclusiveService] createSeries:', err);
        return throwError(() => err);
      })
    );
  }

  // ─── CONTENUS EXCLUSIFS ─────────────────────────────────────────────────────

  /**
   * Récupère les contenus featured (à la une)
   */
  getFeaturedContents(): Observable<ExclusiveContent[]> {
    return this.api.filter<ExclusiveContent>(this.EXCLUSIVE_CONTENT_RESOURCE, {
      filters: { featured: true },
      options: { sort: { created_at: 'desc' }, limit: 10 }
    }).pipe(
      map(result => {
        this.featuredSubject.next(result.data);
        return result.data;
      }),
      catchError(err => {
        console.error('[ExclusiveService] getFeaturedContents:', err);
        return of([]);
      })
    );
  }

  /**
   * Récupère tous les contenus exclusifs avec filtres
   */
  getAllContents(filters?: {
    type?: 'video' | 'behind' | 'masterclass';
    locked?: boolean;
    seriesId?: string;
    search?: string;
  }): Observable<ExclusiveContent[]> {
    const apiFilters: any = {};
    
    if (filters?.type) apiFilters.type = filters.type;
    if (filters?.locked !== undefined) apiFilters.locked = filters.locked;
    if (filters?.seriesId) apiFilters.seriesId = filters.seriesId;
    if (filters?.search) apiFilters.search = filters.search;

    return this.api.filter<ExclusiveContent>(this.EXCLUSIVE_CONTENT_RESOURCE, {
      filters: apiFilters,
      options: { sort: { created_at: 'desc' } }
    }).pipe(
      map(result => {
        this.allContentsSubject.next(result.data);
        return result.data;
      }),
      catchError(err => {
        console.error('[ExclusiveService] getAllContents:', err);
        return of([]);
      })
    );
  }

  /**
   * Récupère un contenu exclusif par son ID
   */
  getContentById(contentId: string): Observable<ExclusiveContent | null> {
    return this.api.getById<ExclusiveContent>(this.EXCLUSIVE_CONTENT_RESOURCE, contentId).pipe(
      catchError(err => {
        console.error('[ExclusiveService] getContentById:', err);
        return of(null);
      })
    );
  }

  /**
   * Crée un nouveau contenu exclusif
   */
  createExclusiveContent(contentData: Omit<ExclusiveContent, 'id' | 'created_at'>): Observable<ExclusiveContent> {
    const content: Omit<ExclusiveContent, 'id'> = {
      ...contentData,
      created_at: new Date().toISOString()
    };

    return this.api.create<ExclusiveContent>(this.EXCLUSIVE_CONTENT_RESOURCE, content).pipe(
      switchMap(newContent => {
        // Si c'est un épisode de série, mettre à jour la série
        if (newContent.seriesId) {
          return this.updateSeriesEpisodes(newContent.seriesId).pipe(
            map(() => newContent)
          );
        }
        return of(newContent);
      }),
      catchError(err => {
        console.error('[ExclusiveService] createExclusiveContent:', err);
        return throwError(() => err);
      })
    );
  }

  /**
   * Met à jour un contenu exclusif
   */
  updateExclusiveContent(contentId: string, updates: Partial<ExclusiveContent>): Observable<ExclusiveContent> {
    return this.api.patch<ExclusiveContent>(this.EXCLUSIVE_CONTENT_RESOURCE, contentId, updates).pipe(
      catchError(err => {
        console.error('[ExclusiveService] updateExclusiveContent:', err);
        return throwError(() => err);
      })
    );
  }

  /**
   * Supprime un contenu exclusif
   */
  deleteExclusiveContent(contentId: string): Observable<void> {
    return this.api.delete(this.EXCLUSIVE_CONTENT_RESOURCE, contentId).pipe(
      catchError(err => {
        console.error('[ExclusiveService] deleteExclusiveContent:', err);
        return throwError(() => err);
      })
    );
  }

  // ─── NAVIGATION ENTRE ÉPISODES ─────────────────────────────────────────────

  /**
   * Récupère l'épisode suivant d'une série
   */
  getNextEpisode(currentEpisode: ExclusiveContent): Observable<ExclusiveContent | null> {
    if (!currentEpisode.seriesId || !currentEpisode.episodeNumber) {
      return of(null);
    }

    return this.api.filter<ExclusiveContent>(this.EXCLUSIVE_CONTENT_RESOURCE, {
      filters: {
        seriesId: currentEpisode.seriesId,
        episodeNumber: currentEpisode.episodeNumber + 1
      }
    }).pipe(
      map(result => result.data[0] || null),
      catchError(err => {
        console.error('[ExclusiveService] getNextEpisode:', err);
        return of(null);
      })
    );
  }

  /**
   * Récupère l'épisode précédent d'une série
   */
  getPreviousEpisode(currentEpisode: ExclusiveContent): Observable<ExclusiveContent | null> {
    if (!currentEpisode.seriesId || !currentEpisode.episodeNumber || currentEpisode.episodeNumber <= 1) {
      return of(null);
    }

    return this.api.filter<ExclusiveContent>(this.EXCLUSIVE_CONTENT_RESOURCE, {
      filters: {
        seriesId: currentEpisode.seriesId,
        episodeNumber: currentEpisode.episodeNumber - 1
      }
    }).pipe(
      map(result => result.data[0] || null),
      catchError(err => {
        console.error('[ExclusiveService] getPreviousEpisode:', err);
        return of(null);
      })
    );
  }

  // ─── UTILITAIRES ─────────────────────────────────────────────────────────────

  /**
   * Met à jour la liste des épisodes d'une série
   */
   updateSeriesEpisodes(seriesId: string): Observable<Series> {
    return this.getEpisodesBySeriesId(seriesId).pipe(
      switchMap(episodes => {
        const episodeIds = episodes.map(ep => ep.id);
        return this.api.patch<Series>(this.SERIES_RESOURCE, seriesId, {
          episodeIds,
          totalEpisodes: episodes.length
        });
      })
    );
  }

  /**
   * Incrémente le nombre de vues d'un contenu
   */
  incrementViewCount(contentId: string): Observable<ExclusiveContent> {
    return this.getContentById(contentId).pipe(
      switchMap(content => {
        if (!content) return throwError(() => new Error('Content not found'));
        
        return this.updateExclusiveContent(contentId, {
          viewCount: (content.viewCount || 0) + 1
        });
      })
    );
  }

  /**
   * Vérifie si un utilisateur a accès à un contenu
   */
  hasUserAccess(userId: string, content: ExclusiveContent): boolean {
    if (!content.locked) return true;
    // TODO: Implémenter la logique de vérification d'achat/abonnement
    return false;
  }
}
