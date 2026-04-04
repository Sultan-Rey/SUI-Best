// src/app/services/PROFILE_SERVICE/profile.service.ts
import { EventEmitter, Injectable } from '@angular/core';
import { Observable, of, EMPTY, throwError, BehaviorSubject, from } from 'rxjs';
import { map, switchMap, debounceTime, distinctUntilChanged, startWith, catchError, expand, reduce, takeWhile, scan, filter } from 'rxjs/operators';
import { ApiJSON } from '../API/api-json';
import { UserProfile } from '../../models/User';
import { User } from 'firebase/auth';
import { options } from 'ionicons/icons';

@Injectable({
  providedIn: 'root'
})
export class ProfileService {
  private resource = 'profiles';
  private readonly uploadResource = 'storage/profiles';
  private searchQuery$ = new BehaviorSubject<string>('');
  private searchResults$ = new BehaviorSubject<UserProfile[]>([]);
   // EventEmitter pour les erreurs de connexion
  public connectionError = new EventEmitter<boolean>();
  /**
   * Configure le flux de recherche en temps réel
   */
  private setupSearchStream(): void {
    this.searchQuery$.pipe(
      debounceTime(300), // Attendre 300ms après la dernière frappe
      distinctUntilChanged(), // Éviter les recherches dupliquées
      switchMap(query => this.performSearch(query))
    ).subscribe(results => {
      this.searchResults$.next(results);
    });
  }

  constructor(private api: ApiJSON) { // ✅ Migration vers notre ApiJSON unifié
    this.setupSearchStream();
    // Écouter les événements de connexion du service API
    this.api.connectionError.subscribe((isConnected: boolean) => {
      this.connectionError.emit(isConnected);
    });
    
   }

 
  
  /* =====================
     CREATE
     ===================== */
  createProfile(profile:UserProfile): Observable<UserProfile> {
    return this.api.create<UserProfile>(this.resource, profile);
  }

  /* =====================
     READ
     ===================== */
  getProfiles(): Observable<UserProfile[]> {
    return this.api.get<UserProfile[]>(this.resource);
  }

  getProfileById(id: string): Observable<UserProfile | null> {
    return this.api.getById<UserProfile | null>(this.resource, id);
  }

  getProfileByUsername(username: string): Observable<UserProfile | null> {
    return this.api.filter<UserProfile>(this.resource, {filters: {username: username}}).pipe(
      map(profiles => {
        if (profiles && profiles.data.length > 0) {
          return profiles.data[0]; // Retourne le premier profil trouvé
        }
        return null; // Aucun profil trouvé
      }),
      catchError(error => {
        console.error('Erreur lors de la recherche du profil par username:', error);
        return of(null); // Retourne null en cas d'erreur
      })
    );
  }

  /* =====================
     UPDATE
     ===================== */
  updateProfile(id: string, updates: Partial<UserProfile>): Observable<UserProfile> {
    return this.api.patch<UserProfile>(this.resource, id, updates);
  }

  updateProfileWithAvatar(
    file: File,
    userProfileId: string,
    updatingData : {
        avatar: string;
        displayName: string,
        bio: string,
        contact: string,
      },
    progressCallback?: (progress: number) => void
  ): Observable<UserProfile> {
  
   
    return this.api.upload<{ file: { path: string } }>( 
      file, 
      'profiles',
    ).pipe(
      switchMap((event: any) => {
    // Handle progress events
    if (event.type) {
      if (progressCallback && event.loaded !== undefined && event.total) {
        const progress = Math.round((100 * event.loaded) / event.total);
        progressCallback(progress);
      }
      // Return an empty observable that doesn't emit any values
      return EMPTY;
    }
  
    // Handle the final response
    const uploadResponse = event.body || event;
    updatingData.avatar = uploadResponse.file.path;
    
    // Return the API call that patch the profile
    return this.api.patch<UserProfile>(this.resource, userProfileId, updatingData);
  }),
      catchError(error => {
        console.error('Erreur lors de la mise a jour du profile:', error);
        return throwError(() => error);
      })
    );
  }
  /* =====================
     UPLOAD AVATAR
     ===================== */
  uploadAvatar(
    profileId: string, 
    avatarDataUrl: string, 
    progressCallback?: (progress: number) => void
  ): Observable<{ url: string }> {
    // Convertir dataURL en File
    return new Observable<{ url: string }>((observer) => {
      try {
        // Extraire le type MIME et les données base64
        const matches = avatarDataUrl.match(/^data:(.+?);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
          observer.error(new Error('Format d\'image invalide'));
          return;
        }

        const mimeType = matches[1];
        const base64Data = matches[2];
        
        // Convertir base64 en blob
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mimeType });

        // Créer un fichier avec un nom approprié
        const fileName = `avatar_${profileId}_${Date.now()}.${mimeType.split('/')[1] || 'jpg'}`;
        const file = new File([blob], fileName, { type: mimeType });

        // Utiliser la méthode upload de l'API avec gestion de progression
        this.api.upload<{ url: string }>( 
          file, 
          'profiles',
        ).pipe(
          switchMap((event: any) => {
            // Handle progress events
            if (event.type) {
              if (progressCallback && event.loaded !== undefined && event.total) {
                const progress = Math.round((100 * event.loaded) / event.total);
                progressCallback(progress);
              }
              // Return an empty observable that doesn't emit any values
              return EMPTY;
            }

            // Handle the final response
            const uploadResponse = event.body || event;
            return of(uploadResponse);
          }),
          catchError(error => {
            console.error('Erreur lors de l\'upload de l\'avatar:', error);
            return throwError(() => error);
          })
        ).subscribe({
          next: (result) => {
            observer.next(result);
            observer.complete();
          },
          error: (error) => {
            observer.error(error);
          }
        });
      } catch (error) {
        observer.error(error);
      }
    });
  }


  /* =====================
     DELETE OLD AVATAR
     ===================== */
  deleteOldAvatar(oldAvatarUrl: string): Observable<void> {
    if (!oldAvatarUrl || oldAvatarUrl.includes('avatar-default.png')) {
      return of(void 0); // Ne rien faire si c'est l'avatar par défaut
    }

    // Pour l'instant, on loggue la demande de suppression
    // La suppression de fichiers devra être implémentée côté backend avec un endpoint dédié
    console.log('Demande de suppression d\'ancien avatar:', oldAvatarUrl);
    
    // TODO: Implémenter un endpoint dédié pour la suppression de fichiers
    // return this.http.delete(`${this.api.BASE_URL}/upload/avatars/${fileName}`);
    
    // Pour l'instant, on retourne un succès pour ne pas bloquer le flux
    return of(void 0);
  }

  /* =====================
     DELETE
     ===================== */
  deleteProfile(id: string): Observable<void> {
    return this.api.delete(this.resource, id);
  }

  /* ====================
     FOLLOW/UNFOLLOW
     ==================== */
  // Dans profile.service.ts

async followProfile(userId: string, profileIdToFollow: string): Promise<any> {
  try {
    // 1. Récupérer l'utilisateur qui suit
    const user = await this.api.getById<UserProfile>(this.resource, userId).toPromise();
    if (!user) throw new Error('Utilisateur non trouvé');

    // 2. Récupérer le profil à suivre
    const profileToFollow = await this.api.getById<UserProfile>(this.resource, profileIdToFollow).toPromise();
    if (!profileToFollow) throw new Error('Profil à suivre non trouvé');

    const myFollows = Array.isArray(user.myFollows) ? user.myFollows : [];
    
    if (!myFollows.includes(profileIdToFollow)) {
      // 3. Mettre à jour la liste des follows de l'utilisateur
      user.myFollows = [...myFollows, profileIdToFollow];
      
      // 4. Incrémenter le compteur de followers du profil suivi
      profileToFollow.stats = profileToFollow.stats || { fans: 0, following: 0 };
      profileToFollow.stats.fans = (profileToFollow.stats.fans || 0) + 1;

      // 5. Mettre à jour les deux profils en parallèle
      await Promise.all([
        this.api.update(this.resource, userId, user).toPromise(),
        this.api.update(this.resource, profileIdToFollow, profileToFollow).toPromise()
      ]);

      return { user, profile: profileToFollow };
    }
    return { user, profile: profileToFollow };
  } catch (error) {
    console.error('Erreur followProfile:', error);
    throw error;
  }
}

async unfollowProfile(userId: string, profileIdToUnfollow: string): Promise<any> {
  try {
    // 1. Récupérer l'utilisateur qui se désabonne
    const user = await this.api.getById<UserProfile>(this.resource, userId).toPromise();
    if (!user) throw new Error('Utilisateur non trouvé');

    // 2. Récupérer le profil à ne plus suivre
    const profileToUnfollow = await this.api.getById<UserProfile>(this.resource, profileIdToUnfollow).toPromise();
    if (!profileToUnfollow) throw new Error('Profil à ne plus suivre non trouvé');

    const myFollows = Array.isArray(user.myFollows) ? user.myFollows : [];
    user.myFollows = myFollows.filter(id => id !== profileIdToUnfollow);
    
    // 3. Décrémenter le compteur de followers du profil
    if (profileToUnfollow.stats?.fans && profileToUnfollow.stats.fans > 0) {
      profileToUnfollow.stats.fans -= 1;
    }

    // 4. Mettre à jour les deux profils en parallèle
    await Promise.all([
      this.api.update(this.resource, userId, user).toPromise(),
      this.api.update(this.resource, profileIdToUnfollow, profileToUnfollow).toPromise()
    ]);

    return { user, profile: profileToUnfollow };
  } catch (error) {
    console.error('Erreur unfollowProfile:', error);
    throw error;
  }
}

async blackListProfile(userId: string, profileIdToBlackList: string): Promise<any> {
  try {
    // 1. Récupérer l'utilisateur qui blacklist
    const user = await this.api.getById<UserProfile>(this.resource, userId).toPromise();
    if (!user) throw new Error('Utilisateur non trouvé');

    // 2. Récupérer le profil à blacklister
    const profileToBlackList = await this.api.getById<UserProfile>(this.resource, profileIdToBlackList).toPromise();
    if (!profileToBlackList) throw new Error('Profil à blacklister non trouvé');

    const myBlackList = Array.isArray(user.myBlackList) ? user.myBlackList : [];
    
    if (!myBlackList.includes(profileIdToBlackList)) {
      // 3. Ajouter le profil à la blacklist de l'utilisateur
      user.myBlackList = [...myBlackList, profileIdToBlackList];

      // 4. Si l'utilisateur suivait ce profil, le retirer des follows
      if (user.myFollows && user.myFollows.includes(profileIdToBlackList)) {
        user.myFollows = user.myFollows.filter(id => id !== profileIdToBlackList);
        
        // 5. Décrémenter le compteur de followers du profil blacklisté
        if (profileToBlackList.stats?.fans && profileToBlackList.stats.fans > 0) {
          profileToBlackList.stats.fans -= 1;
        }
      }

      // 6. Mettre à jour les deux profils en parallèle
      await Promise.all([
        this.api.update(this.resource, userId, user).toPromise(),
        this.api.update(this.resource, profileIdToBlackList, profileToBlackList).toPromise()
      ]);

      return { user, profile: profileToBlackList };
    }
    return { user, profile: profileToBlackList };
  } catch (error) {
    console.error('Erreur blackListProfile:', error);
    throw error;
  }
}

async unblackListProfile(userId: string, profileIdToUnblackList: string): Promise<any> {
  try {
    // 1. Récupérer l'utilisateur qui unblacklist
    const user = await this.api.getById<UserProfile>(this.resource, userId).toPromise();
    if (!user) throw new Error('Utilisateur non trouvé');

    // 2. Récupérer le profil à unblacklist
    const profileToUnblackList = await this.api.getById<UserProfile>(this.resource, profileIdToUnblackList).toPromise();
    if (!profileToUnblackList) throw new Error('Profil à unblacklist non trouvé');

    const myBlackList = Array.isArray(user.myBlackList) ? user.myBlackList : [];
    user.myBlackList = myBlackList.filter(id => id !== profileIdToUnblackList);

    // 3. Mettre à jour l'utilisateur
    await this.api.update(this.resource, userId, user).toPromise();

    return { user, profile: profileToUnblackList };
  } catch (error) {
    console.error('Erreur unblackListProfile:', error);
    throw error;
  }
}

  /**
   * Récupère les 12 profils d'artistes avec le plus grand nombre de fans
   * @returns Un Observable contenant un tableau des 12 profils d'artistes les plus populaires
   */
  getTopArtists(limit: number = 12): Observable<UserProfile[]> {
    return this.api.filter<UserProfile>(this.resource, {}, {cache:false}).pipe(
      map(profiles => {
        // Filtrer pour ne garder que les artistes
        const artists = profiles.data.filter(profile => profile.type === 'artist');
        
        // Trier par nombre de fans décroissant
        return artists.sort((a, b) => {
          const fansA = a.stats?.fans || 0;
          const fansB = b.stats?.fans || 0;
          return fansB - fansA;
        })
        // Prendre les 'limit' premiers
        .slice(0, limit);
      })
    );
  }

  /**
   * Récupère les profils de créateurs avec le plus grand nombre de publications
   * @param limit Nombre maximum de créateurs à retourner (par défaut 12)
   * @returns Un Observable contenant un tableau des profils de créateurs les plus actifs
   */
  getTopCreators(limit: number = 12): Observable<UserProfile[]> {
    return this.api.filter<UserProfile>(this.resource,{}, {cache:false}).pipe(
      map(profiles => {
        // Filtrer pour ne garder que les créateurs
        const creators = profiles.data.filter(profile => profile.type === 'creator');
        
        // Trier par nombre de publications décroissant
        return creators.sort((a, b) => {
          const postsA = a.stats?.posts || 0;
          const postsB = b.stats?.posts || 0;
          return postsB - postsA;
        })
        // Prendre les 'limit' premiers
        .slice(0, limit);
      })
    );
  }

  /**
 * Récupère les meilleurs fans basés sur plusieurs critères
 * @param limit Nombre maximum de fans à retourner (par défaut 10)
 * @returns Un Observable contenant un tableau des profils des meilleurs fans
 */
getTopFans(limit: number = 10): Observable<UserProfile[]> {
  return this.api.filter<UserProfile>(this.resource, {}, {cache:false}).pipe(
    map(profiles => {
      // Filtrer pour ne garder que les fans (pas les artistes)
      const fans = profiles.data.filter(profile => 
        profile.type === 'fan' || !profile.type
      );

      // Trier selon plusieurs critères
      return fans
        .map(profile => {
          // Calculer un score basé sur plusieurs facteurs
          const followsScore = (profile.myFollows?.length || 0) * 1.5; // Poids plus important pour les follows
          const votesScore = (profile.stats?.votes || 0) * 1.2; // Poids moyen pour les votes
          const starsScore = (profile.stats?.stars || 0); // Poids normal pour les étoiles
          
          // Score total pondéré
          const totalScore = followsScore + votesScore + starsScore;
          
          return {
            ...profile,
            _score: totalScore
          };
        })
        // Trier par score décroissant
        .sort((a, b) => b._score - a._score)
        // Prendre les 'limit' premiers
        .slice(0, limit)
        // Retirer le score temporaire
        .map(({ _score, ...profile }) => profile);
    })
  );
}

  isFollowing(userId: string, profileId: string): Observable<boolean> {
    return this.api.getById<UserProfile>(this.resource, userId).pipe(
      map(user => {
        // Assurez-vous que myFollows est un tableau
      const myFollows = Array.isArray(user?.myFollows) ? user.myFollows : [];
      return myFollows.includes(profileId);
    })
  );
}

  /* ====================
     SEARCH PROFILES
     ==================== */

  /**
   * Effectue la recherche de profils selon le critère fourni
   * @param query Terme de recherche (username, displayName, bio, etc.)
   * @returns Observable avec les résultats de la recherche
   */
  private performSearch(query: string): Observable<UserProfile[]> {
    if (!query || query.trim().length < 2) {
      return of([]);
    }

    const searchTerm = query.toLowerCase().trim();

    return this.getProfiles().pipe(
      map(profiles => {
        return profiles.filter(profile => {
          // Recherche dans le username
          const usernameMatch = profile.username?.toLowerCase().includes(searchTerm);
          
          // Recherche dans le displayName
          const displayNameMatch = profile.displayName?.toLowerCase().includes(searchTerm);
          
          // Recherche dans la bio
          const bioMatch = profile.userInfo.bio?.toLowerCase().includes(searchTerm);
          
          // Recherche dans le type d'utilisateur
          const userTypeMatch = profile.type?.toLowerCase().includes(searchTerm);
          
          // Recherche dans l'école
          const schoolMatch = profile.userInfo.school.name.toLowerCase().includes(searchTerm);
          
          // Retourner true si au moins un critère correspond
          return usernameMatch || displayNameMatch || bioMatch || userTypeMatch || schoolMatch;
        });
      })
    );
  }

  /**
   * Met à jour la requête de recherche (appelé depuis les composants)
   * @param query Nouveau terme de recherche
   */
  updateSearchQuery(query: string): void {
    this.searchQuery$.next(query);
  }

  /**
   * Observable pour écouter les résultats de recherche en temps réel
   * @returns Observable avec les résultats de recherche actuels
   */
  getSearchResults(): Observable<UserProfile[]> {
    return this.searchResults$.asObservable();
  }

  /**
   * Observable pour écouter la requête de recherche actuelle
   * @returns Observable avec la requête de recherche actuelle
   */
  getSearchQuery(): Observable<string> {
    return this.searchQuery$.asObservable();
  }

  /**
   * Recherche avancée avec filtres multiples
   * @param criteria Critères de recherche avancés
   * @returns Observable avec les résultats filtrés
   */
  searchProfiles(criteria: {
    query?: string;
    userType?: 'artist' | 'creator' | 'fan';
    minFans?: number;
    hasPosts?: boolean;
    limit?: number;
  }): Observable<UserProfile[]> {
    return this.getProfiles().pipe(
      map(profiles => {
        let filteredProfiles = profiles;

        // Filtrer par terme de recherche
        if (criteria.query && criteria.query.trim().length >= 2) {
          const searchTerm = criteria.query.toLowerCase().trim();
          filteredProfiles = filteredProfiles.filter(profile => 
            profile.username?.toLowerCase().includes(searchTerm) ||
            profile.displayName?.toLowerCase().includes(searchTerm) ||
            profile.userInfo.bio?.toLowerCase().includes(searchTerm)
          );
        }

        // Filtrer par type d'utilisateur
        if (criteria.userType) {
          filteredProfiles = filteredProfiles.filter(profile => 
            profile.type === criteria.userType
          );
        }

        // Filtrer par nombre minimum de fans
        if (criteria.minFans && criteria.minFans > 0) {
          filteredProfiles = filteredProfiles.filter(profile => 
            (profile.stats?.fans || 0) >= criteria.minFans!
          );
        }

        // Filtrer par présence de publications
        if (criteria.hasPosts) {
          filteredProfiles = filteredProfiles.filter(profile => 
            (profile.stats?.posts || 0) > 0
          );
        }

        // Limiter les résultats
        if (criteria.limit && criteria.limit > 0) {
          filteredProfiles = filteredProfiles.slice(0, criteria.limit);
        }

        return filteredProfiles;
      })
    );
  }

  /**
   * Suggestions de recherche populaires
   * @param limit Nombre de suggestions à retourner
   * @returns Observable avec les suggestions de profils populaires
   */
  getSearchSuggestions(limit: number = 5): Observable<UserProfile[]> {
    return this.getProfiles().pipe(
      map(profiles => {
        // Trier par popularité (fans + posts) et retourner les plus populaires
        return profiles
          .map(profile => ({
            ...profile,
            popularityScore: (profile.stats?.fans || 0) + ((profile.stats?.posts || 0) * 10)
          }))
          .sort((a, b) => b.popularityScore - a.popularityScore)
          .slice(0, limit)
          .map(({ popularityScore, ...profile }) => profile);
      })
    );
  }

  /**
   * Efface les résultats de recherche
   */
  clearSearch(): void {
    this.searchQuery$.next('');
    this.searchResults$.next([]);
  }

  /* ====================
     SEARCH IN MYFOLLOWS WITH PAGINATION
     ==================== */

  /**
   * Recherche progressive d'un UserId dans les myFollows des UserProfile avec pagination
   * @param targetUserId L'ID de l'utilisateur à rechercher
   * @param pageSize Nombre de résultats par page (défaut: 10)
   * @returns Observable qui émet les résultats progressivement avec pagination
   */
  searchUserIdInMyFollows(targetUserId: string, pageSize: number = 10): Observable<{
    results: UserProfile[];
    hasMore: boolean;
    currentPage: number;
    totalCount: number;
    found: boolean;
  }> {
    type SearchResult = {
      results: UserProfile[];
      hasMore: boolean;
      currentPage: number;
      totalCount: number;
      found: boolean;
    };

    type ExpandedResult = SearchResult & {
      allProfiles: UserProfile[];
    };

    return this.getProfiles().pipe(
      map(profiles => {
        // Filtrer les profils qui ont des myFollows et qui contiennent le targetUserId
        const profilesMatching = profiles.filter(profile => 
          Array.isArray(profile.myFollows) && 
          profile.myFollows.includes(targetUserId)
        );

        return {
          allProfiles: profilesMatching,
          totalCount: profilesMatching.length
        };
      }),
      expand(({ allProfiles, totalCount }) => {
        // Si nous avons déjà traité tous les profils, arrêter l'expansion
        if (allProfiles.length === 0) {
          return of({ results: [], hasMore: false, currentPage: 0, totalCount, found: totalCount > 0 });
        }

        // Prendre la prochaine page de résultats
        const nextPage = allProfiles.slice(0, pageSize);
        const remainingProfiles = allProfiles.slice(pageSize);

        return of({
          results: nextPage,
          hasMore: remainingProfiles.length > 0,
          currentPage: Math.floor((totalCount - remainingProfiles.length) / pageSize),
          totalCount,
          found: totalCount > 0,
          allProfiles: remainingProfiles
        } as ExpandedResult);
      }),
      map((result: ExpandedResult | SearchResult): SearchResult => {
        // Retourner seulement les propriétés SearchResult
        if ('allProfiles' in result) {
          const { allProfiles, ...searchResult } = result;
          return searchResult;
        }
        return result;
      })
    );
  }

  /**
   * Version simplifiée qui retourne seulement les profiles contenant le UserId
   * @param targetUserId L'ID de l'utilisateur à rechercher
   * @param limit Nombre maximum de résultats (optionnel)
   * @returns Observable avec les UserProfile trouvés
   */
  findProfilesFollowingUser(targetUserId: string, limit?: number): Observable<UserProfile[]> {
    return this.getProfiles().pipe(
      map(profiles => {
        let results = profiles.filter(profile => 
          Array.isArray(profile.myFollows) && 
          profile.myFollows.includes(targetUserId)
        );

        if (limit && limit > 0) {
          results = results.slice(0, limit);
        }

        return results;
      })
    );
  }

  /**
   * Vérifie si un utilisateur est suivi par d'autres utilisateurs et retourne les détails
   * @param targetUserId L'ID de l'utilisateur à vérifier
   * @returns Observable avec les détails sur qui suit cet utilisateur
   */
  getUserFollowersDetails(targetUserId: string): Observable<{
    isFollowedByAnyone: boolean;
    followerCount: number;
    followers: UserProfile[];
  }> {
    return this.findProfilesFollowingUser(targetUserId).pipe(
      map(followers => ({
        isFollowedByAnyone: followers.length > 0,
        followerCount: followers.length,
        followers: followers
      }))
    );
  }

  /* ====================
     GET PROFILES BY IDS
     ==================== */

  /**
   * Retrouve les UserProfile correspondants aux IDs fournis
   * @param profileIds Tableau d'IDs de profils à retrouver
   * @returns Observable avec les UserProfile trouvés
   */
  getProfilesByIds(profileIds: string[]): Observable<UserProfile[]> {
    if (!profileIds || profileIds.length === 0) {
      return of([]);
    }

    // Éliminer les doublons et les valeurs vides
    const uniqueIds = [...new Set(profileIds.filter(id => id && id.trim() !== ''))];

    if (uniqueIds.length === 0) {
      return of([]);
    }

    return this.getProfiles().pipe(
      map(profiles => {
        // Filtrer les profils qui correspondent aux IDs fournis
        return profiles.filter(profile => uniqueIds.includes(profile.id));
      })
    );
  }

  /**
   * Version progressive avec pagination pour retrouver les UserProfile par IDs
   * @param profileIds Tableau d'IDs de profils à retrouver
   * @param pageSize Nombre de résultats par page (défaut: 10)
   * @returns Observable qui émet les résultats progressivement avec pagination
   */
  getProfilesByIdsPaginated(profileIds: string[], pageSize: number = 10): Observable<{
    results: UserProfile[];
    hasMore: boolean;
    currentPage: number;
    totalCount: number;
    processedIds: string[];
    remainingIds: string[];
  }> {
    if (!profileIds || profileIds.length === 0) {
      return of({
        results: [],
        hasMore: false,
        currentPage: 0,
        totalCount: 0,
        processedIds: [],
        remainingIds: []
      });
    }

    // Éliminer les doublons et les valeurs vides
    const uniqueIds = [...new Set(profileIds.filter(id => id && id.trim() !== ''))];
    
    if (uniqueIds.length === 0) {
      return of({
        results: [],
        hasMore: false,
        currentPage: 0,
        totalCount: 0,
        processedIds: [],
        remainingIds: []
      });
    }

    type PaginatedResult = {
      results: UserProfile[];
      hasMore: boolean;
      currentPage: number;
      totalCount: number;
      processedIds: string[];
      remainingIds: string[];
    };

    return this.getProfiles().pipe(
      map(allProfiles => {
        // Filtrer tous les profils qui correspondent aux IDs
        const matchingProfiles = allProfiles.filter(profile => uniqueIds.includes(profile.id));
        
        return {
          allProfiles: matchingProfiles,
          totalCount: matchingProfiles.length,
          allIds: uniqueIds
        };
      }),
      expand(({ allProfiles, totalCount, allIds }) => {
        // Si nous avons déjà traité tous les profils, arrêter l'expansion
        if (allProfiles.length === 0) {
          return of({
            results: [],
            hasMore: false,
            currentPage: Math.ceil(allIds.length / pageSize),
            totalCount,
            processedIds: allIds,
            remainingIds: []
          });
        }

        // Prendre la prochaine page de résultats
        const nextPage = allProfiles.slice(0, pageSize);
        const remainingProfiles = allProfiles.slice(pageSize);
        
        const processedCount = Math.min(pageSize, allProfiles.length);
        const currentPage = Math.floor(processedCount / pageSize);

        return of({
          results: nextPage,
          hasMore: remainingProfiles.length > 0,
          currentPage,
          totalCount,
          processedIds: nextPage.map(p => p.id),
          remainingIds: remainingProfiles.map(p => p.id)
        });
      })
    );
  }

  /**
   * Retrouve les UserProfile par IDs avec gestion d'erreur pour les IDs non trouvés
   * @param profileIds Tableau d'IDs de profils à retrouver
   * @returns Observable avec les résultats et les IDs non trouvés
   */
  getProfilesByIdsWithNotFound(profileIds: string[]): Observable<{
    found: UserProfile[];
    notFound: string[];
  }> {
    if (!profileIds || profileIds.length === 0) {
      return of({ found: [], notFound: [] });
    }

    const uniqueIds = [...new Set(profileIds.filter(id => id && id.trim() !== ''))];

    return this.getProfilesByIds(uniqueIds).pipe(
      map(foundProfiles => {
        const foundIds = foundProfiles.map(profile => profile.id);
        const notFound = uniqueIds.filter(id => !foundIds.includes(id));
        
        return {
          found: foundProfiles,
          notFound: notFound
        };
      })
    );
  }

}