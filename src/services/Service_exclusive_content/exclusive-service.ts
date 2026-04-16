import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, forkJoin, map, of, switchMap, throwError } from 'rxjs';
import { ApiJSON } from '../API/api-json';
import { ExclusiveContent, ExclusiveContentType, ExclusiveContentStatus, Series, Author, SeriesInfo, MediaInfo } from '../../models/Content';
import { ProfileService } from '../Service_profile/profile-service';

@Injectable({
  providedIn: 'root',
})
export class ExclusiveService {
  private readonly SERIES_RESOURCE = 'series';
  private readonly EXCLUSIVE_CONTENT_RESOURCE = 'exclusive_contents';
  private readonly SERIES_WITH_EPISODES_VIEW = 'series_with_episodes';
  private readonly CONTENTS_WITH_SERIES_INFO_VIEW = 'contents_with_series_info';

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
   * Récupère une série par son ID avec ses épisodes (optimisé avec vue)
   */
  getSeriesById(seriesId: string): Observable<Series | null> {
    // Utiliser la vue optimisée pour une seule requête
    return this.api.getById<Series>(this.SERIES_WITH_EPISODES_VIEW, seriesId).pipe(
      map(series => {
        // La vue retourne déjà les episodes pré-calculés
        return series;
      }),
      catchError(err => {
        console.error('[ExclusiveService] getSeriesById (vue):', err);
        // Fallback vers l'ancienne méthode si la vue n'existe pas
        console.warn('[ExclusiveService] Fallback vers méthode classique');
        return this.getSeriesByIdFallback(seriesId);
      })
    );
  }

  /**
   * Méthode fallback classique (2 requêtes)
   */
  private getSeriesByIdFallback(seriesId: string): Observable<Series | null> {
    return this.api.getById<Series>(this.SERIES_RESOURCE, seriesId).pipe(
      switchMap(series => {
        if (!series) return of(null);
        
        // Récupérer les épisodes de la série
        return this.getEpisodesBySeriesId(seriesId).pipe(
          map(episodes => {
            const episodeIds = episodes
              .filter(ep => ep.id) // Filtrer les épisodes avec ID valide
              .map(ep => ep.id!); // Extraire l'ID (non-null)
            
            return {
              ...series,
              episodeIds
            };
          })
        );
      }),
      catchError(err => {
        console.error('[ExclusiveService] getSeriesById (fallback):', err);
        return of(null);
      })
    );
  }

  /**
   * Récupère les épisodes d'une série (optimisé)
   */
  getEpisodesBySeriesId(seriesId: string): Observable<ExclusiveContent[]> {
    // Utiliser la vue optimisée qui inclut déjà les infos de série
    return this.api.filter<ExclusiveContent>(this.CONTENTS_WITH_SERIES_INFO_VIEW, {
      filters: { 'seriesId': seriesId },
      options: { sort: { 'episodeNumber': 'asc' } }
    }).pipe(
      map(result => result.data),
      catchError(err => {
        console.error('[ExclusiveService] getEpisodesBySeriesId (vue):', err);
        // Fallback vers la méthode classique
        return this.getEpisodesBySeriesIdFallback(seriesId);
      })
    );
  }

  /**
   * Méthode fallback classique pour les épisodes
   */
  private getEpisodesBySeriesIdFallback(seriesId: string): Observable<ExclusiveContent[]> {
    return this.api.filter<ExclusiveContent>(this.EXCLUSIVE_CONTENT_RESOURCE, {
      filters: { 'series.seriesId': seriesId },
      options: { sort: { 'series.episodeNumber': 'asc' } }
    }).pipe(
      map(result => result.data),
      catchError(err => {
        console.error('[ExclusiveService] getEpisodesBySeriesId (fallback):', err);
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
   * Récupère les contenus exclusifs avec filtres (optimisé avec vue pour les séries)
   */
  getAllContents(filters?: {
    type?: ExclusiveContentType;
    locked?: boolean;
    seriesId?: string;
    search?: string;
  }): Observable<ExclusiveContent[]> {
    const apiFilters: any = {};
    
    if (filters?.type) apiFilters.type = filters.type;
    if (filters?.locked !== undefined) apiFilters.locked = filters.locked;
    if (filters?.seriesId) apiFilters['seriesId'] = filters.seriesId;
    if (filters?.search) apiFilters.search = filters.search;

    // Utiliser la vue optimisée si on filtre par série
    const resource = filters?.seriesId ? this.CONTENTS_WITH_SERIES_INFO_VIEW : this.EXCLUSIVE_CONTENT_RESOURCE;

    return this.api.filter<ExclusiveContent>(resource, {
      filters: apiFilters,
      options: { sort: { created_at: 'desc' } }
    }).pipe(
      map(result => {
        // Mapper les champs de la vue vers la structure attendue
        const mappedData = result.data.map(content => ({
          ...content,
          series: content.series ? {
            seriesId: content.series.seriesId,
            seriesTitle: (content as any).parent_series_title,
            episodeNumber: content.series?.episodeNumber,
            totalEpisodes: (content as any).parent_series_total_episodes
          } : undefined
        }));
        
        this.allContentsSubject.next(mappedData);
        return mappedData;
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
 createExclusiveContent(contentData: Omit<ExclusiveContent, 'id' | 'created_at' | 'updated_at'>): Observable<ExclusiveContent> {
  const seriesId = contentData.series?.seriesId;

  // Si c'est une série, on vérifie d'abord son existence
  if (seriesId) {
    return this.getSeriesById(seriesId).pipe(
      switchMap(existingSeries => {
        if (!existingSeries) {
          // LA SÉRIE N'EXISTE PAS : ON LA CRÉE
          return this.createSeries({
            title: contentData.series?.seriesTitle || 'Nouvelle Série',
            description: contentData.description,
            author: contentData.author,
            thumbnail: (contentData.media.thumbnail as any), // Cast nécessaire selon votre erreur précédente
            type: contentData.type as 'masterclass' | 'behind' | 'series',
            totalEpisodes: contentData.series?.totalEpisodes || 1
          }).pipe(
            switchMap(() => this.api.create<ExclusiveContent>(this.EXCLUSIVE_CONTENT_RESOURCE, contentData))
          );
        }
        // LA SÉRIE EXISTE : ON CRÉE JUSTE L'ÉPISODE
        return this.api.create<ExclusiveContent>(this.EXCLUSIVE_CONTENT_RESOURCE, contentData);
      }),
      // Enfin, on met à jour les compteurs de la série (épisodes, IDs, etc.)
      switchMap(newContent => this.updateSeriesEpisodes(seriesId).pipe(map(() => newContent)))
    );
  }

  // Cas standard (vidéo simple)
  return this.api.create<ExclusiveContent>(this.EXCLUSIVE_CONTENT_RESOURCE, contentData);
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

  // ─── UTILITAIRES ─────────────────────────────────────────────────────────────

  /**
   * Met à jour la liste des épisodes d'une série (optimisé)
   */
  updateSeriesEpisodes(seriesId: string): Observable<Series> {
    // Utiliser la vue pour obtenir les épisodes déjà comptés
    return this.api.getById<Series>(this.SERIES_WITH_EPISODES_VIEW, seriesId).pipe(
      switchMap(seriesData => {
        if (!seriesData) {
          // Fallback si la vue ne fonctionne pas
          return this.updateSeriesEpisodesFallback(seriesId);
        }

        // La vue retourne déjà les episodes pré-calculés
        return this.api.patch<Series>(this.SERIES_RESOURCE, seriesId, {
          episodeIds: (seriesData as any).episodeIds || [],
          totalEpisodes: (seriesData as any).actual_episodes_count || 0
        });
      }),
      catchError(err => {
        console.error('[ExclusiveService] updateSeriesEpisodes (vue):', err);
        return this.updateSeriesEpisodesFallback(seriesId);
      })
    );
  }

  /**
   * Méthode fallback classique pour updateSeriesEpisodes
   */
  private updateSeriesEpisodesFallback(seriesId: string): Observable<Series> {
    return this.getEpisodesBySeriesIdFallback(seriesId).pipe(
      switchMap(episodes => {
        const episodeIds = episodes
          .filter(ep => ep.id) // Filtrer les épisodes avec ID valide
          .map(ep => ep.id!); // Extraire l'ID (non-null)
        
        return this.api.patch<Series>(this.SERIES_RESOURCE, seriesId, {
          episodeIds,
          totalEpisodes: episodes.length
        });
      })
    );
  }

  // ─── NAVIGATION ENTRE ÉPISODES ─────────────────────────────────────────────

  /**
   * Récupère l'épisode suivant d'une série
   */
  getNextEpisode(currentEpisode: ExclusiveContent): Observable<ExclusiveContent | null> {
    if (!currentEpisode.series?.seriesId || !currentEpisode.series?.episodeNumber) {
      return of(null);
    }

    return this.api.filter<ExclusiveContent>(this.EXCLUSIVE_CONTENT_RESOURCE, {
      filters: {
        'series.seriesId': currentEpisode.series.seriesId,
        'series.episodeNumber': currentEpisode.series.episodeNumber + 1
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
    if (!currentEpisode.series?.seriesId || !currentEpisode.series?.episodeNumber || currentEpisode.series.episodeNumber <= 1) {
      return of(null);
    }

    return this.api.filter<ExclusiveContent>(this.EXCLUSIVE_CONTENT_RESOURCE, {
      filters: {
        'series.seriesId': currentEpisode.series.seriesId,
        'series.episodeNumber': currentEpisode.series.episodeNumber - 1
      }
    }).pipe(
      map(result => result.data[0] || null),
      catchError(err => {
        console.error('[ExclusiveService] getPreviousEpisode:', err);
        return of(null);
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
        
        // Note: La nouvelle structure n'a pas de viewCount, 
        // cette méthode pourrait être adaptée ou supprimée
        console.warn('[ExclusiveService] incrementViewCount: viewCount non disponible dans la nouvelle structure');
        return of(content);
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
