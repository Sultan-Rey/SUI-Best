import { Injectable, EventEmitter } from '@angular/core';
import { BehaviorSubject, catchError, forkJoin, map, take, Subscription, shareReplay, lastValueFrom, Observable, of, switchMap, tap, throwError, filter, concatMap, EMPTY, from } from 'rxjs';
import { ApiJSON } from '../API/api-json';
import { Content, ContentCategory, ContentSource, ContentStatus } from '../../models/Content';
import { UserProfile } from '../../models/User';
import { ProfileService } from '../Service_profile/profile-service';
import { HttpEvent, HttpEventType, HttpResponse } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class CreationService {

  private readonly RESOURCE = 'contents';

 

  // ─── Stores ───────────────────────────────────────────────────
  private newContentSubject    = new BehaviorSubject<Content | null>(null);
  private discoveryFeedSubject = new BehaviorSubject<Content[]>([]);
  private followedFeedSubject  = new BehaviorSubject<Content[]>([]);
  private bannerAdsSubject    = new BehaviorSubject<Content[]>([]);
  private postAdsSubject    = new BehaviorSubject<Content[]>([]);

  newContent$    = this.newContentSubject.asObservable();
  discoveryFeed$ = this.discoveryFeedSubject.asObservable();
  followedFeed$  = this.followedFeedSubject.asObservable();
  bannerAds$    = this.bannerAdsSubject.asObservable();
  postAds$    = this.postAdsSubject.asObservable();

  constructor(
    private api: ApiJSON,
    private profileService: ProfileService
  ) {
  }

  // ==============================================================
  //  UPLOAD + CRÉATION
  // ==============================================================
 
  /**
   * Orchestre l'upload complet : Miniature (si vidéo) PUIS Vidéo par chunks
   * CORRIGÉ : Plus de double souscription !
   */
  createVideoWithThumbnail(
    file: File, 
    thumbnailBlob: Blob, 
    metadata: any
  ): Observable<{ progress: number; content?: Content; step?: string }> {
    
    const thumbFile = new File([thumbnailBlob], `thumb_${Date.now()}.webp`, { type: 'image/webp' });
 
    // ✅ CORRECTION : uploadThumbnail retourne déjà un Observable, pas besoin de from()
    return this.uploadThumbnail(thumbFile).pipe(
      // Émettre la progression du thumbnail (0-5%)
      map(thumbResponse => ({
        progress: 5,
        step: 'thumbnail-uploaded',
        thumbnailUrl: thumbResponse,
        content: undefined
      })),
      
      // Une fois le thumbnail uploadé, on passe à la vidéo
      switchMap(thumbResult => {
        const updatedMetadata = {
          ...metadata,
          thumbnailUrl: thumbResult.thumbnailUrl
        };
 
        // Upload de la vidéo avec progression (5-100%)
        return this.createContentWithFile(file, updatedMetadata).pipe(
          map(val => ({
            progress: Math.round(5 + (val.progress * 0.95)),
            content: val.content ? {
              ...val.content,
              thumbnailUrl: thumbResult.thumbnailUrl
            } : undefined,
            step: val.content ? 'completed' : 'uploading-video'
          }))
        );
      }),
      
      // ✅ CRITIQUE : shareReplay pour éviter les uploads multiples
      shareReplay(1),
      
      catchError(err => {
        console.error('[ContentService] Video with thumbnail upload error:', err);
        return throwError(() => err);
      })
    );
  }
 
  /**
   * Upload par chunks avec gestion de progression optimisée
   * CORRIGÉ : Ne crée le Content qu'UNE SEULE FOIS après le dernier chunk
   */
  createContentWithFile(
    file: File, 
    metadata: any
  ): Observable<{ progress: number; content?: Content }> {
 
    const CHUNK_SIZE = 2 * 1024 * 1024; // 2 Mo
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const uuid = crypto.randomUUID();
    
    const chunkIndices = Array.from({ length: totalChunks }, (_, i) => i);
 
    // Variable pour stocker le dernier response.path
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
        }, 'contents').pipe(
          // ✅ CORRECTION : Filtrer UNIQUEMENT les Response (pas les UploadProgress)
          filter(event => event.type === HttpEventType.Response),
          map(event => {
            const body = (event as HttpResponse<any>).body;
            
            // Stocker le path si disponible
            if (body?.path) {
              finalPath = body.path;
            }
 
            const globalProgress = Math.round(((index + 1) / totalChunks) * 100);
            
            return { 
              progress: globalProgress,
              isLastChunk: index === totalChunks - 1,
              path: finalPath
            };
          })
        );
      }),
      
      // ✅ CORRECTION : switchMap appelé UNE SEULE FOIS après le dernier chunk
      switchMap((status: any) => {
        // Si ce n'est pas le dernier chunk, juste émettre la progression
        if (!status.isLastChunk) {
          return of({ progress: status.progress, content: undefined });
        }
 
        // ✅ Dernier chunk : créer le Content
        if (!status.path) {
          return throwError(() => new Error('Upload failed: no file path returned'));
        }
 
        const contentData = {
          ...metadata,
          fileUrl: status.path,
          mimeType: file.type,
          fileSize: file.size,
          created_at: new Date().toISOString(),
        };
 
        console.log('[ContentService] Creating content with data:', contentData);
 
        return this.api.create<Content>(this.RESOURCE, contentData).pipe(
          map(content => {
            this.newContentSubject.next(content);
            console.log('[ContentService] Content created successfully:', content.id);
            return { progress: 100, content };
          })
        );
      }),
      
      // ✅ CRITIQUE : shareReplay pour éviter les uploads multiples
      shareReplay(1),
      
      catchError(err => {
        console.error('[ContentService] Chunked upload error:', err);
        return throwError(() => err);
      })
    );
  }
 
  /**
   * Upload de thumbnail simplifié
   * CORRIGÉ : Retourne directement l'URL sans callbacks
   */
  uploadThumbnail(file: File): Observable<string> {
    return this.api.upload<any>(file, 'contents/thumbnails').pipe(
      filter(event => event.type === HttpEventType.Response),
          map(event => {
            const body = (event as HttpResponse<any>).body;
            
            // Stocker le path si disponible
            if (body?.path) {
            return body.path;
            }
        
        return EMPTY;
      }),
      take(1),
      catchError(error => {
        console.error('[ContentService] Thumbnail upload error:', error);
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
    private uploadVideoFileOnly(file: File): Observable<{ progress: number; videoUrl?: string }> {
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
                finalPath = event.body.path;
      
              }
            
              const globalProgress = Math.round(((index + 1) / totalChunks) * 100);
              
              return { 
                progress: globalProgress, 
                videoUrl: undefined 
              };
            })
          );
        }),
        concatMap(status => {
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

  /**
   * Création du Content avec les URLs déjà uploadées
   */
  createContentWithUploadedFiles(
    thumbnailUrl: string,
    videoUrl: string,
    metadata: any
  ): Observable<Content> {
    
    const contentData = {
      ...metadata,
      fileUrl: videoUrl,
      thumbnailUrl: thumbnailUrl,
      mimeType: 'video/mp4',
      created_at: new Date().toISOString(),
    };

    //console.log('[ContentService] Creating content with uploaded files:', contentData);

    return this.api.create<Content>(this.RESOURCE, contentData).pipe(
      tap(content => {
        this.newContentSubject.next(content);
      })
    );
  }


 
  // ==============================================================
  //  CRUD
  // ==============================================================

  createContent(content: Partial<Content>): Observable<Content> {
    return this.api.create<Content>(this.RESOURCE, content).pipe(
      tap(c => this.newContentSubject.next(c))
    );
  }

  getContentById(id: string): Observable<Content> {
    return this.api.getById<Content>(this.RESOURCE, id);
  }

  updateContent(id: string, updates: Partial<Content>): Observable<Content> {
    return this.api.patch<Content>(this.RESOURCE, id, updates).pipe(
      tap(updated => this.updateLocalContentInFeeds(updated))
    );
  }

  deleteContent(id: string): Observable<void> {
    return this.api.delete(this.RESOURCE, id);
  }

  /**
   * Incrémente le viewCount via un simple PATCH — une seule requête.
   */
  incrementViewCount(contentId: string): Observable<Content> {
    return this.api.getById<Content>(this.RESOURCE, contentId).pipe(
      switchMap(content => this.api.patch<Content>(this.RESOURCE, contentId, {
        viewCount: (content.viewCount ?? 0) + 1
      })),
      tap(updated => this.updateLocalContentInFeeds(updated)),
      catchError(err => {
        console.error('[CreationService] incrementViewCount:', err);
        return throwError(() => err);
      })
    );
  }

  /**
   * Met à jour uniquement le challengeId d'un contenu.
   */
  updateContentChallengeId(content: Content): Observable<Content> {
    if (!content.id) return throwError(() => new Error('Content ID is required'));
    return this.api.patch<Content>(this.RESOURCE, content.id, {
      challengeId: content.challengeId
    }).pipe(
      tap(updated => this.updateLocalContentInFeeds(updated)),
      catchError(err => {
        console.error('[CreationService] updateContentChallengeId:', err);
        return throwError(() => err);
      })
    );
  }

  // ==============================================================
  //  FEEDS
  // ==============================================================

  /**
   * Feed "Followed" — contenus des utilisateurs suivis + les siens,
   * triés par score décroissant (calculé par le cron PHP).
   */
  getFollowedFeedContents(
    currentUserProfile: UserProfile,
    page = 1,
    limit = 10
  ): Observable<Content[]> {
    const followedIds = [...(currentUserProfile.myFollows ?? []), currentUserProfile.id];

    return this.api.filter<Content>(this.RESOURCE, {
      filters: { status: ContentStatus.PUBLISHED, isPublic: true, category:ContentCategory.POST },
      options: {
        page,
        per_page: limit * 2, // Récupérer plus pour compenser le filtrage
        sort: { score: 'desc' },
        include_meta: true,
      }
    }).pipe(
      map(result => result.data
        .filter(c => followedIds.includes(c.userId))
        .slice(0, limit) // Limiter au nombre demandé
      ),
      tap(contents => {
        page === 1
          ? this.followedFeedSubject.next(contents)
          : this.followedFeedSubject.next([...this.followedFeedSubject.value, ...contents]);
      }),
      catchError(err => {
        console.error('[CreationService] getFollowedFeedContents:', err);
        return of([]);
      })
    );
  }

  /**
   * Feed "Discovery" — contenus des utilisateurs non suivis,
   * triés par score décroissant.
   */
  getDiscoveryFeedContents(
    currentUserProfile: UserProfile,
    page = 1,
    limit = 10
  ): Observable<Content[]> {
    const excludedIds = [...(currentUserProfile.myFollows ?? []), currentUserProfile.id];

    return this.api.filter<Content>(this.RESOURCE, {
      filters: { status: ContentStatus.PUBLISHED, isPublic: true },
      options: {
        page,
        per_page: limit * 2, // Récupérer plus pour compenser le filtrage
        sort: { score: 'desc' },
        include_meta: true,
      }
    }, {cache:true}).pipe(
      map(result => result.data
        .filter(c => !excludedIds.includes(c.userId))
        .filter(c => c.category === ContentCategory.POST || c.category === ContentCategory.ADS_POST)
        .slice(0, limit) // Limiter au nombre demandé
      ),
      tap(contents => {
        page === 1
          ? this.discoveryFeedSubject.next(contents)
          : this.discoveryFeedSubject.next([...this.discoveryFeedSubject.value, ...contents]);
      }),
      catchError(err => {
        console.error('[CreationService] getDiscoveryFeedContents:', err);
        return of([]);
      })
    );
  }

  /**
   * Feed "Post Publicitaires" — contenus publicitaires de type Post,
   * triés par date décroissante.
   */
  getBannerAdsContents(
    page = 1,
    limit = 10
  ): Observable<Content[]> {
    return this.api.filter<Content>(this.RESOURCE, {
      filters: { status: ContentStatus.PUBLISHED, category: ContentCategory.ADS_BANNER, isPublic: true },
      options: {
        page,
        per_page: limit,
        sort: { created_at: 'desc' },
        include_meta: true,
      }
    }).pipe(
      map(result => result.data),
      tap(contents => {
        page === 1
          ? this.bannerAdsSubject.next(contents)
          : this.bannerAdsSubject.next([...this.bannerAdsSubject.value, ...contents]);
      }),
      catchError(err => {
        console.error('[CreationService] getBannerAdsContents:', err);
        return of([]);
      })
    );
  }

   /**
   * Feed "Bannières Publicitaires" — contenus publicitaires de type bannière,
   * triés par date décroissante.
   */
  getPostAdsContents(
    page = 1,
    limit = 10
  ): Observable<Content[]> {
    return this.api.filter<Content>(this.RESOURCE, {
      filters: { status: ContentStatus.PUBLISHED, category: ContentCategory.ADS_POST, isPublic: true },
      options: {
        page,
        per_page: limit,
        sort: { created_at: 'desc' },
        include_meta: true,
      }
    }).pipe(
      map(result => result.data),
      tap(contents => {
        page === 1
          ? this.postAdsSubject.next(contents)
          : this.postAdsSubject.next([...this.postAdsSubject.value, ...contents]);
      }),
      catchError(err => {
        console.error('[CreationService] getPostAdsContents:', err);
        return of([]);
      })
    );
  }

  /**
   * Filtre générique — retourne les contenus selon les critères fournis.
   */
  getContents(filters: Record<string, any>, options?: any): Observable<Content[]> {
    return this.api.filter<Content>(this.RESOURCE, { filters, options }).pipe(
      map(result => result.data),
      catchError(err => {
        console.error('[CreationService] getContents:', err);
        return of([]);
      })
    );
  }

  // ==============================================================
  //  CHALLENGE — STATISTIQUES
  // ==============================================================

  /**
   * Calcule le total des vues pour un challenge.
   */
  getTotalViewsForChallenge(challengeId: string): Observable<number> {
    return this.api.filter<Content>(this.RESOURCE, {
      filters: { challengeId }
    }).pipe(
      map(result => result.data.reduce((sum, c) => sum + (c.viewCount ?? 0), 0)),
      catchError(() => of(0))
    );
  }

  /**
   * Calcule le total des votes pour un challenge.
   */
  getTotalVotesForChallenge(challengeId: string): Observable<number> {
    return this.api.filter<Content>(this.RESOURCE, {
      filters: { challengeId }
    }).pipe(
      map(result => result.data.reduce((sum, c) => sum + (c.voteCount ?? 0), 0)),
      catchError(() => of(0))
    );
  }

  /**
   * Calcule le total des partages pour un challenge.
   */
  getTotalSharesForChallenge(challengeId: string): Observable<number> {
    return this.api.filter<Content>(this.RESOURCE, {
      filters: { challengeId }
    }).pipe(
      map(result => result.data.reduce((sum, c) => sum + (c.shareCount ?? 0), 0)),
      catchError(() => of(0))
    );
  }

  // ==============================================================
  //  CHALLENGE — PARTICIPANTS
  // ==============================================================

  /**
   * Retourne les profils uniques des participants à un challenge.
   */
  getChallengeParticipantProfiles(challengeId: string): Observable<UserProfile[]> {
    return this.api.filter<Content>(this.RESOURCE, {
      filters: { challengeId }
    }).pipe(
      map(result => [...new Set(result.data.map(c => c.userId))]),
      switchMap(userIds => {
        if (!userIds.length) return of([]);
        return forkJoin(
          userIds.map(id =>
            this.profileService.getProfileById(id).pipe(catchError(() => of(null)))
          )
        );
      }),
      map(profiles => profiles.filter((p): p is UserProfile => p !== null)),
      catchError(err => {
        console.error('[CreationService] getChallengeParticipantProfiles:', err);
        return of([]);
      })
    );
  }

  /**
   * Retourne les contenus + profils des participants à un challenge.
   */
  getChallengeParticipants(challengeId: string): Observable<{ content: Content; profile: UserProfile }[]> {
    return this.api.filter<Content>(this.RESOURCE, {
      filters: { challengeId }
    }).pipe(
      switchMap(result => {
        const contents   = result.data;
        if (!contents.length) return of([]);

        const uniqueIds  = [...new Set(contents.map(c => c.userId))];
        return forkJoin(
          uniqueIds.map(id =>
            this.profileService.getProfileById(id).pipe(catchError(() => of(null)))
          )
        ).pipe(
          map(profiles => {
            const profileMap = new Map<string, UserProfile>();
            profiles.forEach((p, i) => { if (p) profileMap.set(uniqueIds[i], p); });

            return contents
              .map(c => ({ content: c, profile: profileMap.get(c.userId) }))
              .filter((item): item is { content: Content; profile: UserProfile } =>
                item.profile !== undefined
              );
          })
        );
      }),
      catchError(err => {
        console.error('[CreationService] getChallengeParticipants:', err);
        return of([]);
      })
    );
  }

  // ==============================================================
  //  PRIVÉS
  // ==============================================================

  private extractTags(text: string): string[] {
    return (text.match(/#(\w+)/g) ?? []).map(t => t.substring(1));
  }

  private updateLocalContentInFeeds(updated: Content): void {
    const update = (list: Content[]) =>
      list.map(c => c.id === updated.id ? updated : c);

    this.discoveryFeedSubject.next(update(this.discoveryFeedSubject.value));
    this.followedFeedSubject.next(update(this.followedFeedSubject.value));

    if (this.newContentSubject.value?.id === updated.id) {
      this.newContentSubject.next(updated);
    }
  }
}
