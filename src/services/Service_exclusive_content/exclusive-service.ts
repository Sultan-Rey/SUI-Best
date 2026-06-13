import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, concatMap, filter, forkJoin, from, map, of, switchMap, take, throwError } from 'rxjs';
import { ApiJSON, FilterOptions, FilterResult } from '../API/api-json';
import { ExclusiveContent, ExclusiveContentType, Series } from '../../models/Content';
import { ProfileService } from '../Service_profile/profile-service';
import { HttpEventType, HttpResponse } from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class ExclusiveService {
   private readonly resource = 'exclusive_contents';
  private readonly seriesResource = 'series';

  constructor(private api: ApiJSON) {}

  // ── CRUD Operations ────────────────────────────────────────────────────────

  /**
   * Upload une miniature et retourne son path
   */
  uploadThumbnail(file: File): Observable<string> {
    return this.api.upload<any>(file, 'exclusives/thumbnails').pipe(
      filter((event: { type: any; }) => event.type === HttpEventType.Response),
      map(event => {
        const body = (event as HttpResponse<any>).body;
        if (body?.path) {
          return body.path;
        }
        throw new Error('Thumbnail upload failed: no path returned');
      }),
      take(1),
      catchError(error => {
        console.error('[ExclusiveContentService] Thumbnail upload error:', error);
        return throwError(() => error);
      })
    );
  }

  /**
     * Upload optimiste : thumbnail + vidéo SANS métadonnées ni création de Content
     * Retourne juste les URLs quand elles sont prêtes
     */
    uploadVideoFilesOnly(
      file: File, 
      thumbnailBlob: Blob
    ): Observable<{ progress: number; thumbnailUrl?: string; videoUrl?: string }> {
      
      const thumbFile = new File([thumbnailBlob], `thumb_${Date.now()}.webp`, { type: 'image/webp' });
  
      // 1. Upload du thumbnail (0-10%)
      return this.uploadThumbnail(thumbFile).pipe(
        map(thumbResponse => ({
          progress: 10,
          thumbnailUrl: thumbResponse,
          videoUrl: undefined
        })),
        // 2. Upload de la vidéo (10-100%)
        switchMap(thumbResult => {
          return this.uploadVideoFileOnly(file).pipe(
            map(videoResult => ({
              progress: Math.round(10 + (videoResult.progress * 0.9)),
              thumbnailUrl: thumbResult.thumbnailUrl,
              videoUrl: videoResult.videoUrl
            }))
          );
        })
      );
    }

    /**
     * Upload vidéo seule SANS création de Content
     */
     uploadVideoFileOnly(file: File): Observable<{ progress: number; videoUrl?: string }> {
      const CHUNK_SIZE = 2 * 1024 * 1024; // 2 Mo
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      const uuid = crypto.randomUUID();
      const chunkIndices = Array.from({ length: totalChunks }, (_, i) => i);
  
      let finalPath: string | null = null;
  
      return from(chunkIndices).pipe(
        concatMap(index => {
          const start = index * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, file.size);
          const chunk = file.slice(start, end);
  
          return this.api.uploadChunk<any>(chunk, {
            index,
            total: totalChunks,
            uuid,
            filename: file.name
          }).pipe(
              filter(event => event.type === HttpEventType.Response),
              map(event => {
              const body = (event as HttpResponse<any>).body;
              if (body?.path) {
                finalPath = body.path;
      
              }
            
              const globalProgress = Math.round(((index + 1) / totalChunks) * 100);
              
              return { 
                progress: globalProgress, 
                videoUrl: undefined 
              };
            })
          );
        }),
        concatMap((status: { progress: number; videoUrl?: string }) => {
          if (status.progress < 100) {
            return of(status);
          }
  
          // Dernier chunk : retourner l'URL finale
          if (!finalPath) {
            return throwError(() => new Error('Upload failed: no file path returned'));
          }
  
          return of({
            progress: 100,
            videoUrl: finalPath
          });
        })
      );
    }

    deleteVideoWithThumbnail(videoPath?: string, thumbnailPath?: string): Observable<{ success: boolean; message: string }> {
    // Si aucun paramètre fourni
    if (!videoPath && !thumbnailPath) {
      return throwError(() => new Error('No file paths provided'));
    }

    // Si seulement le thumbnail est fourni
    if (!videoPath && thumbnailPath) {
      return this.api.deleteFile(thumbnailPath).pipe(
        map(() => ({ success: true, message: 'Thumbnail deleted successfully' })),
        catchError((error) => {
          console.error('[ExclusiveContentService] Error deleting thumbnail:', error);
          return throwError(() => error);
        })
      );
    }

    // Si seulement la vidéo est fournie
    if (videoPath && !thumbnailPath) {
      return this.api.deleteFile(videoPath).pipe(
        map(() => ({ success: true, message: 'Video deleted successfully' })),
        catchError((error) => {
          console.error('[ExclusiveContentService] Error deleting video:', error);
          return throwError(() => error);
        })
      );
    }

    // Si les deux sont fournis
    if (videoPath && thumbnailPath) {
      return this.api.deleteFile(thumbnailPath).pipe(
        switchMap((response) => {
          if (response.success) {
            return this.api.deleteFile(videoPath);
          } else {
            return throwError(() => new Error('Failed to delete thumbnail'));
          }
        }),
        map(() => ({ success: true, message: 'Video and thumbnail deleted successfully' })),
        catchError((error) => {
          console.error('[ExclusiveContentService] Error deleting video with thumbnail:', error);
          return throwError(() => error);
        })
      );
    }

    return throwError(() => new Error('Invalid parameters'));
  }

  // ── CRUD Operations ────────────────────────────────────────────────────────

  /**
   * Récupère tous les contenus exclusifs
   */
  getAll(): Observable<ExclusiveContent[]> {
    return this.api.get<ExclusiveContent[]>(this.resource);
  }

  /**
   * Récupère un contenu exclusif par son ID
   */
  getById(id: string): Observable<ExclusiveContent> {
    return this.api.getById<ExclusiveContent>(this.resource, id);
  }

  /**
   * Crée un nouveau contenu exclusif
   */
  create(content: Partial<ExclusiveContent>): Observable<ExclusiveContent> {
    return this.api.create<ExclusiveContent>(this.resource, content);
  }

  

  /**
   * Met à jour un contenu exclusif
   */
  update(id: string, content: Partial<ExclusiveContent>): Observable<ExclusiveContent> {
    return this.api.update<ExclusiveContent>(this.resource, id, content);
  }

  /**
   * Met à jour partiellement un contenu exclusif
   */
  patch(id: string, content: Partial<ExclusiveContent>): Observable<ExclusiveContent> {
    return this.api.patch<ExclusiveContent>(this.resource, id, content);
  }

  /**
   * Supprime un contenu exclusif
   */
  delete(id: string): Observable<void> {
    return this.api.delete(this.resource, id);
  }

  // ── Filtrage et Recherche ───────────────────────────────────────────────────

  /**
   * Filtre les contenus exclusifs selon divers critères
   */
  filter(filters: FilterOptions): Observable<FilterResult<ExclusiveContent>> {
    return this.api.filter<ExclusiveContent>(this.resource, filters);
  }

  /**
   * Récupère les contenus par type
   */
  getByType(type: string): Observable<ExclusiveContent[]> {
    return this.filter({
      filters: { type }
    }).pipe(
      // @ts-ignore
      response => response.data
    );
  }

  /**
   * Récupère les contenus par statut
   */
  getByStatus(status: string): Observable<ExclusiveContent[]> {
    return this.filter({
      filters: { status }
    }).pipe(
      // @ts-ignore
      response => response.data
    );
  }

  /**
   * Récupère les contenus d'un utilisateur
   */
  getByUserId(userId: string): Observable<ExclusiveContent[]> {
    return this.filter({
      filters: { userId }
    }).pipe(
      // @ts-ignore
      response => response.data
    );
  }

  /**
   * Récupère les contenus verrouillés/payants
   */
  getLockedContent(): Observable<ExclusiveContent[]> {
    return this.filter({
      filters: { locked: true }
    }).pipe(
      // @ts-ignore
      response => response.data
    );
  }

  /**
   * Récupère les contenus gratuits
   */
  getFreeContent(): Observable<ExclusiveContent[]> {
    return this.filter({
      filters: { locked: false }
    }).pipe(
      // @ts-ignore
      response => response.data
    );
  }

  // ── Gestion des Séries ─────────────────────────────────────────────────────

  /**
   * Récupère toutes les séries
   */
  getAllSeries(): Observable<Series[]> {
    return this.api.get<Series[]>(this.seriesResource);
  }

  /**
   * Récupère une série par son ID
   */
  getSeriesById(id: string): Observable<Series> {
    return this.api.getById<Series>(this.seriesResource, id);
  }

  /**
   * Crée une nouvelle série
   */
  createSeries(series: Partial<Series>): Observable<Series> {
    return this.api.create<Series>(this.seriesResource, series);
  }

  /**
   * Met à jour une série
   */
  updateSeries(id: string, series: Partial<Series>): Observable<Series> {
    return this.api.update<Series>(this.seriesResource, id, series);
  }

  /**
   * Supprime une série
   */
  deleteSeries(id: string): Observable<void> {
    return this.api.delete(this.seriesResource, id);
  }

  /**
   * Récupère les épisodes d'une série
   */
  getSeriesEpisodes(seriesId: string): Observable<ExclusiveContent[]> {
    return this.filter({
      filters: { 'series.seriesId': seriesId }
    }).pipe(
      // @ts-ignore
      response => response.data
    );
  }

  // ── Opérations Spécifiques ───────────────────────────────────────────────────

  /**
   * Déverrouille un contenu pour un utilisateur
   */
  unlockContent(contentId: string, userId: string): Observable<ExclusiveContent> {
    return this.api.request<ExclusiveContent>(
      'POST',
      `${this.resource}/${contentId}/unlock`,
      { userId }
    );
  }

  /**
   * Vérifie si un utilisateur a accès à un contenu
   */
  checkAccess(contentId: string, userId: string): Observable<{ hasAccess: boolean }> {
    return this.getById(contentId).pipe(
      // @ts-ignore
      map(content => ({
        hasAccess: content.watchers?.includes(userId) ?? false
      }))
    );
  }

 

 

  // ── Statistiques ─────────────────────────────────────────────────────────────

  /**
   * Récupère les statistiques d'un contenu
   */
  getContentStats(contentId: string): Observable<{
    views: number;
    likes: number;
    shares: number;
    revenue: number;
    watchers: number;
  }> {
    return this.api.request<any>(
      'GET',
      `${this.resource}/${contentId}/stats`
    );
  }

  /**
   * Récupère les statistiques générales de l'utilisateur
   */
  getUserStats(userId: string): Observable<{
    totalContent: number;
    totalViews: number;
    totalRevenue: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
  }> {
    return this.api.request<any>(
      'GET',
      `${this.resource}/stats/${userId}`
    );
  }
}

