import { Injectable, EventEmitter } from '@angular/core';
import { BehaviorSubject, catchError, forkJoin, map, Observable, of, switchMap, tap, throwError, filter } from 'rxjs';
import { ApiJSON } from '../API/api-json';
import { Content, ContentCategory, ContentSource, ContentStatus } from '../../models/Content';
import { UserProfile } from '../../models/User';
import { ProfileService } from '../Service_profile/profile-service';

@Injectable({ providedIn: 'root' })
export class CreationService {

  private readonly RESOURCE = 'contents';

 

  // ─── Stores ───────────────────────────────────────────────────
  private newContentSubject    = new BehaviorSubject<Content | null>(null);
  private discoveryFeedSubject = new BehaviorSubject<Content[]>([]);
  private followedFeedSubject  = new BehaviorSubject<Content[]>([]);
  private bannerAdsSubject    = new BehaviorSubject<Content[]>([]);

  newContent$    = this.newContentSubject.asObservable();
  discoveryFeed$ = this.discoveryFeedSubject.asObservable();
  followedFeed$  = this.followedFeedSubject.asObservable();
  bannerAds$    = this.bannerAdsSubject.asObservable();

  constructor(
    private api: ApiJSON,
    private profileService: ProfileService
  ) {
  }

  // ==============================================================
  //  UPLOAD + CRÉATION
  // ==============================================================

  /**
   * Uploade un fichier média puis crée l'entrée Content en base.
   * Le fichier est stocké dans /storage/contents/ via MediaController.
   */
  createContentWithFile(
    file: File,
    metadata: {
      userId: string;
      description?: string;
      isPublic: boolean;
      allowDownloads: boolean;
      allowComments: boolean;
      commentIds: string[];
      likedIds: string[];
      status: ContentStatus;
      category: ContentCategory;
      challengeId?: string;
      cadrage: 'default' | 'fit';
      source: ContentSource;
    }
  ): Observable<Content> {

    return this.api.upload<{ path: string; url: string; mime: string; size: number }>(
      file,
      'contents'  // → stocké dans /storage/contents/
    ).pipe(
      // L'upload retourne des HttpEvents — on attend le dernier (HttpResponse)
      switchMap((event: any) => {
        if (!event?.body) return of(null); // ignorer les events de progression
        const res = event.body;

        const contentData: Omit<Content, 'id'> = {
          ...metadata,
          fileUrl:      res.path,           // chemin relatif pour /download?path=
          mimeType:     file.type,
          fileSize:     file.size,
          challengeId:  metadata.challengeId ?? '',
          created_at:    new Date().toISOString(),
          tags:         this.extractTags(metadata.description ?? ''),
        };

        return this.api.create<Content>(this.RESOURCE, contentData);
      }),
      // Filtrer les null (events de progression)
      switchMap(result => result ? of(result) : of(null as any)),
      tap(content => { if (content) this.newContentSubject.next(content); }),
      catchError(err => {
        console.error('[CreationService] createContentWithFile:', err);
        return throwError(() => err);
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
      filters: { status: ContentStatus.PUBLISHED, isPublic: true },
      options: {
        page,
        per_page: limit * 2, // Récupérer plus pour compenser le filtrage
        sort: { score: 'desc' },
        include_meta: true,
      }
    }).pipe(
      map(result => result.data
        .filter(c => followedIds.includes(c.userId))
        .filter(c => c.category === ContentCategory.POST || c.category === ContentCategory.ADS_POST)
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
   * Feed "Bannières Publicitaires" — contenus publicitaires de type bannière,
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
        sort: { createdAt: 'desc' },
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
